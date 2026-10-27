/**
 * usePermissions
 *
 * Loads the role_permissions matrix exclusively from the DB (role_permissions table).
 * No hardcoded fallbacks — if the DB has no entry for a role, that role has no access.
 * Apply the Supabase migrations, then save the canonical defaults from the
 * Permission Manager to populate the DB.
 *
 *   canSeeApp(appId)                 — app visible in launchpad?
 *   canSeeSection(appId, sectionId)  — section visible within an app?
 *   can(action, appId)               — legacy action check
 *   canAccess(appId)                 — alias for canSeeApp
 *   allowedActions(appId)            — list of permitted actions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { UserRole, PermissionAction, ApplicationId } from '../../types/rbac';
import { API_BASE, apiFetch, apiHeaders }from '../utils/constants';
import { DEFAULT_SECTION_VISIBILITY } from '../../constants/permissionSections';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RolePermissionBlob {
  app_visibility?: Record<string, boolean>;
  sections?: Record<string, Record<string, boolean>>;
  actions?: string[];
}

const EMPTY_BLOB: RolePermissionBlob = { app_visibility: {}, sections: {} };

// ── DB fetch ──────────────────────────────────────────────────────────────────

let _cachedMatrix: Record<string, RolePermissionBlob> | null = null;
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000;
let _inflight: Promise<Record<string, RolePermissionBlob>> | null = null;

export let permissionsTableMissing = false;

async function fetchMatrix(): Promise<Record<string, RolePermissionBlob>> {
  const now = Date.now();
  if (_cachedMatrix && now - _cacheTs < CACHE_TTL) return _cachedMatrix;

  // If already fetching, return the same promise
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const res = await apiFetch(`${API_BASE}/permissions`, {
        cache: 'no-store',
        headers: apiHeaders(),
      });

      if (res.status === 503) {
        const body = await res.json().catch(() => ({}));
        if (body?.table_missing) {
          permissionsTableMissing = true;
          _cachedMatrix = {};
          _cacheTs = Date.now();
          return {};
        }
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`permissions fetch failed (${res.status}): ${body}`);
      }
      permissionsTableMissing = false;

      const json = await res.json();
      const raw: Record<string, any> = json?.permissionMatrix ?? {};

      const matrix: Record<string, RolePermissionBlob> = {};
      for (const [role, data] of Object.entries(raw)) {
        if (data && typeof data === 'object' && ('app_visibility' in data || 'sections' in data)) {
          const hasLegacyActions = Array.isArray(data.actions);
          const hasStoredSections = data.sections &&
            typeof data.sections === 'object' &&
            Object.keys(data.sections).length > 0;
          matrix[role] = {
            app_visibility: data.app_visibility ?? {},
            // Legacy rows had apps/actions but no sections. Use the canonical
            // role defaults only for those rows; modern all-off matrices remain
            // intentionally all-off.
            sections: hasLegacyActions && !hasStoredSections
              ? DEFAULT_SECTION_VISIBILITY[role as keyof typeof DEFAULT_SECTION_VISIBILITY] ?? {}
              : data.sections ?? {},
            actions: Array.isArray(data.actions) ? data.actions : [],
          };
        }
      }

      _cachedMatrix = matrix;
      _cacheTs = Date.now();
      return matrix;
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
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
      return effectiveBlobs.some(blob =>
        blob.app_visibility?.['*'] === true ||
        blob.app_visibility?.[appId] === true
      );
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
      if (
        effectiveBlobs.some(blob =>
          (
            blob.app_visibility?.['*'] === true ||
            blob.app_visibility?.[String(appId)] === true
          ) &&
          (blob.actions?.includes('*') || blob.actions?.includes(action))
        )
      ) {
        return true;
      }
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
