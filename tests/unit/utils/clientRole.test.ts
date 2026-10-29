import { describe, expect, it } from 'vitest';
import {
  APP_BY_ID,
  CLIENT_GRANTABLE_APP_IDS,
  clientCanBeGrantedApp,
} from '../../../src/constants/appRegistry';
import {
  ALL_ROLES,
  buildDefaultPermissions,
  DEFAULT_APP_VISIBILITY,
  DEFAULT_SECTION_VISIBILITY,
} from '../../../src/constants/permissionSections';
import { getPrimaryRole } from '../../../src/utils/rbac/permissionChecker';
import { ROLE_DEFINITIONS } from '../../../src/utils/rbac/roleDefinitions';

describe('client role defaults', () => {
  it('is available throughout role management', () => {
    expect(ALL_ROLES).toContain('client');
    expect(ROLE_DEFINITIONS.client.name).toBe('Client');
    expect(getPrimaryRole(['client'])).toBe('client');
  });

  it('grants only Defect Tracker app visibility by default', () => {
    const defaults = buildDefaultPermissions('client');
    const visibleApps = Object.entries(defaults.app_visibility)
      .filter(([, visible]) => visible)
      .map(([appId]) => appId);

    expect(visibleApps).toEqual(['defect-tracker']);
    expect(DEFAULT_APP_VISIBILITY.client).toEqual({ 'defect-tracker': true });
    expect(APP_BY_ID['defect-tracker'].requiredRoles).toContain('client');
  });

  it('allows normal defect collaboration but not destructive administration', () => {
    expect(DEFAULT_SECTION_VISIBILITY.client['defect-tracker']).toEqual({
      view_defects: true,
      log_defect: true,
      update_defects: true,
      delete_defects: false,
      manage_sla: false,
      escalate: false,
      analytics: true,
      export: true,
    });
  });

  it('locks sensitive internal applications from future client grants', () => {
    expect([...CLIENT_GRANTABLE_APP_IDS]).toEqual([
      'defect-tracker',
      'projects',
      'documentation',
      'communications',
      'training',
    ]);
    expect(clientCanBeGrantedApp('payroll')).toBe(false);
    expect(clientCanBeGrantedApp('user-management')).toBe(false);
    expect(clientCanBeGrantedApp('permissions')).toBe(false);
    expect(clientCanBeGrantedApp('audit-logs')).toBe(false);
  });
});
