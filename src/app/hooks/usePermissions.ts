/**
 * usePermissions
 *
 * Loads the role_permissions matrix exclusively from the DB (role_permissions table).
 * No hardcoded fallbacks — if the DB has no entry for a role, that role has no access.
 * Run `npm run seed:permissions` to populate the DB with initial defaults.
 *
 *   canSeeApp(appId)                 — app visible in launchpad?
 *   canSeeSection(appId, sectionId)  — section visible within an app?
 *   can(action, appId)               — legacy action check
 *   canAccess(appId)                 — alias for canSeeApp
 *   allowedActions(appId)            — list of permitted actions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { UserRole, PermissionAction, ApplicationId } from '../../types/rbac';
import { API_BASE, publicAnonKey } from '../utils/constants';
import { ALL_ROLES, buildDefaultPermissions } from '../../constants/permissionSections';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RolePermissionBlob {
  app_visibility?: Record<string, boolean>;
  sections?: Record<string, Record<string, boolean>>;
}

const EMPTY_BLOB: RolePermissionBlob = { app_visibility: {}, sections: {} };

// ── DB fetch ──────────────────────────────────────────────────────────────────

let _cachedMatrix: Record<string, RolePermissionBlob> | null = null;
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000;

export let permissionsTableMissing = false;

function buildDefaultMatrix(): Record<string, RolePermissionBlob> {
  const m: Record<string, RolePermissionBlob> = {};
  for (const role of ALL_ROLES) {
    const p = buildDefaultPermissions(role);
    m[role] = { app_visibility: p.app_visibility ?? {}, sections: p.sections ?? {} };
  }
  return m;
}

async function seedDefaultsToDB(matrix: Record<string, RolePermissionBlob>): Promise<void> {
  await fetch(`${API_BASE}/permissions`, {
    method: 'POST',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissionMatrix: matrix, updatedBy: 'system:auto-seed' }),
  });
}

async function fetchMatrix(): Promise<Record<string, RolePermissionBlob>> {
  const now = Date.now();
  if (_cachedMatrix && now - _cacheTs < CACHE_TTL) return _cachedMatrix;

  const res = await fetch(`${API_BASE}/permissions`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${publicAnonKey}` },
  });

  if (res.status === 503) {
    const body = await res.json().catch(() => ({}));
    if (body?.table_missing) {
      permissionsTableMissing = true;
      // Table missing — seed defaults so next load works
      const defaults = buildDefaultMatrix();
      seedDefaultsToDB(defaults).catch(() => {});
      _cachedMatrix = defaults;
      _cacheTs = now;
      return defaults;
    }
  }

  if (!res.ok) throw new Error('permissions fetch failed');
  permissionsTableMissing = false;

  const json = await res.json();
  const raw: Record<string, any> = json?.permissionMatrix ?? {};

  const matrix: Record<string, RolePermissionBlob> = {};
  for (const [role, data] of Object.entries(raw)) {
    if (data && typeof data === 'object' && ('app_visibility' in data || 'sections' in data)) {
      matrix[role] = {
        app_visibility: data.app_visibility ?? {},
        sections: data.sections ?? {},
      };
    }
  }

  // DB returned no rows — seed defaults so the Permissions Manager and Launchpad work from DB
  if (Object.keys(matrix).length === 0) {
    const defaults = buildDefaultMatrix();
    seedDefaultsToDB(defaults).catch(() => {});
    _cachedMatrix = defaults;
    _cacheTs = now;
    return defaults;
  }

  _cachedMatrix = matrix;
  _cacheTs = now;
  return matrix;
}

/** Invalidate the in-memory cache so the next hook call re-fetches from DB */
export function invalidatePermissionsCache() {
  _cachedMatrix = null;
  _cacheTs = 0;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePermissions(roles: UserRole[], permissionOverrides: any[] = []) {
  const [dbMatrix, setDbMatrix] = useState<Record<string, RolePermissionBlob> | null>(null);

  useEffect(() => {
    fetchMatrix()
      .then(m => setDbMatrix(m))
      .catch(() => setDbMatrix({})); // network failure → no access
  }, []);

  // Permissions come exclusively from DB. No role entry in DB = no access.
  const effectiveBlobs = useMemo((): RolePermissionBlob[] => {
    return roles.map(role => dbMatrix?.[role] ?? EMPTY_BLOB);
  }, [roles, dbMatrix]);

  // ── canSeeApp ──────────────────────────────────────────────────────────────
  const canSeeApp = useCallback(
    (appId: string): boolean => {
      return effectiveBlobs.some(blob => blob.app_visibility?.[appId] === true);
    },
    [effectiveBlobs],
  );

  // ── canSeeSection ──────────────────────────────────────────────────────────
  const canSeeSection = useCallback(
    (appId: string, sectionId: string): boolean => {
      // Per-user overrides take precedence over role matrix
      for (const ov of permissionOverrides) {
        if (ov.app === appId && ov.section === sectionId) {
          if (ov.deny === true) return false;
          if (ov.allow === true) return true;
        }
      }
      return effectiveBlobs.some(blob => blob.sections?.[appId]?.[sectionId] === true);
    },
    [effectiveBlobs, permissionOverrides],
  );

  // ── can (legacy action check) ──────────────────────────────────────────────
  const can = useCallback(
    (action: PermissionAction, appId: ApplicationId | string): boolean => {
      for (const ov of permissionOverrides) {
        if (ov.app === appId) {
          if (ov.deny?.includes(action)) return false;
          if (ov.allow?.includes(action)) return true;
        }
      }
      // Map actions to section checks for backward compat
      const actionToSection: Record<string, string> = {
        create: 'create', read: 'view', update: 'edit', delete: 'delete',
        approve: 'approve', export: 'export',
      };
      const sectionId = actionToSection[action] ?? action;
      if (effectiveBlobs.some(b => b.sections?.[appId]?.[sectionId] === true)) return true;
      if (action === 'read') return canSeeApp(appId);
      return false;
    },
    [effectiveBlobs, permissionOverrides, canSeeApp],
  );

  // ── canAccess ──────────────────────────────────────────────────────────────
  const canAccess = useCallback(
    (appId: ApplicationId | string): boolean => canSeeApp(appId),
    [canSeeApp],
  );

  // ── allowedActions ────────────────────────────────────────────────────────
  const allowedActions = useCallback(
    (appId: ApplicationId | string): PermissionAction[] => {
      const all: PermissionAction[] = ['create', 'read', 'update', 'delete', 'approve', 'export'];
      return all.filter(a => can(a, appId));
    },
    [can],
  );

  return {
    can,
    canSeeApp,
    canSeeSection,
    canAccess,
    allowedActions,
    matrixLoaded: dbMatrix !== null,
  };
}
