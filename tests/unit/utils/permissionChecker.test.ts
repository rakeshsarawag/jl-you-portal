import { describe, it, expect } from 'vitest';
import {
  canAccessApp,
  canPerformAction,
  getAccessibleApps,
  getAllowedActions,
  isAdmin,
  hasAnyRole,
  hasAllRoles,
  getPrimaryRole,
} from '../../../src/utils/rbac/permissionChecker';

// ---------------------------------------------------------------------------
// canAccessApp
// ---------------------------------------------------------------------------
describe('canAccessApp', () => {
  // admin
  it('admin gets access to all apps', () => {
    const apps = [
      'onboarding', 'employee-dashboard', 'recruitment', 'performance',
      'documentation', 'it-services', 'training', 'invoices', 'linkedin',
      'master-data', 'payroll', 'projects', 'communications', 'assets',
      'okr', 'directory', 'knowledge-base',
    ] as const;
    for (const app of apps) {
      expect(canAccessApp(['admin'], app).granted).toBe(true);
    }
  });

  // hr
  it('hr can access recruitment', () => {
    expect(canAccessApp(['hr'], 'recruitment').granted).toBe(true);
  });
  it('hr can access performance', () => {
    expect(canAccessApp(['hr'], 'performance').granted).toBe(true);
  });
  it('hr can access payroll', () => {
    expect(canAccessApp(['hr'], 'payroll').granted).toBe(true);
  });
  it('hr can access onboarding', () => {
    expect(canAccessApp(['hr'], 'onboarding').granted).toBe(true);
  });
  it('hr can access linkedin (read-only)', () => {
    // hr has READ on linkedin, so granted should be true
    expect(canAccessApp(['hr'], 'linkedin').granted).toBe(true);
  });

  // finance
  it('finance can access invoices', () => {
    expect(canAccessApp(['finance'], 'invoices').granted).toBe(true);
  });
  it('finance can access payroll', () => {
    expect(canAccessApp(['finance'], 'payroll').granted).toBe(true);
  });
  it('finance cannot access onboarding (only READ, still granted)', () => {
    // finance has READ on onboarding — granted
    expect(canAccessApp(['finance'], 'onboarding').granted).toBe(true);
  });

  // manager
  it('manager can access projects', () => {
    expect(canAccessApp(['manager'], 'projects').granted).toBe(true);
  });
  it('manager can access performance', () => {
    expect(canAccessApp(['manager'], 'performance').granted).toBe(true);
  });

  // employee
  it('employee can access employee-dashboard', () => {
    expect(canAccessApp(['employee'], 'employee-dashboard').granted).toBe(true);
  });
  it('employee can access knowledge-base', () => {
    expect(canAccessApp(['employee'], 'knowledge-base').granted).toBe(true);
  });
  it('employee can access payroll (read only)', () => {
    expect(canAccessApp(['employee'], 'payroll').granted).toBe(true);
  });

  // it role
  it('it can access it-services', () => {
    expect(canAccessApp(['it'], 'it-services').granted).toBe(true);
  });
  it('it can access assets', () => {
    expect(canAccessApp(['it'], 'assets').granted).toBe(true);
  });

  // marketing
  it('marketing can access linkedin', () => {
    expect(canAccessApp(['marketing'], 'linkedin').granted).toBe(true);
  });

  // guest — empty actions for most apps → denied
  it('guest is denied invoices', () => {
    expect(canAccessApp(['guest'], 'invoices').granted).toBe(false);
  });
  it('guest is denied payroll', () => {
    expect(canAccessApp(['guest'], 'payroll').granted).toBe(false);
  });
  it('guest can access documentation (has READ)', () => {
    expect(canAccessApp(['guest'], 'documentation').granted).toBe(true);
  });

  // empty roles
  it('empty roles are denied every app', () => {
    expect(canAccessApp([], 'recruitment').granted).toBe(false);
    expect(canAccessApp([], 'invoices').granted).toBe(false);
    expect(canAccessApp([], 'payroll').granted).toBe(false);
  });

  // unknown role
  it('unknown role is denied', () => {
    expect(canAccessApp(['unicorn' as any], 'projects').granted).toBe(false);
  });

  // denial carries reason
  it('denied result includes a reason string', () => {
    const result = canAccessApp([], 'invoices');
    expect(result.granted).toBe(false);
    expect(typeof result.reason).toBe('string');
    expect(result.reason!.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// canPerformAction
// ---------------------------------------------------------------------------
describe('canPerformAction', () => {
  it('admin can create in any app', () => {
    expect(canPerformAction(['admin'], 'payroll', 'create').granted).toBe(true);
  });
  it('admin can delete in any app', () => {
    expect(canPerformAction(['admin'], 'invoices', 'delete').granted).toBe(true);
  });
  it('admin can approve in any app', () => {
    expect(canPerformAction(['admin'], 'recruitment', 'approve').granted).toBe(true);
  });

  // hr boundaries
  it('hr can create in payroll (FULL)', () => {
    expect(canPerformAction(['hr'], 'payroll', 'create').granted).toBe(true);
  });
  it('hr can delete in payroll (FULL)', () => {
    expect(canPerformAction(['hr'], 'payroll', 'delete').granted).toBe(true);
  });
  it('hr cannot delete invoices (only READ)', () => {
    expect(canPerformAction(['hr'], 'invoices', 'delete').granted).toBe(false);
  });
  it('hr cannot delete linkedin (only READ)', () => {
    expect(canPerformAction(['hr'], 'linkedin', 'delete').granted).toBe(false);
  });

  // employee boundaries
  it('employee cannot create invoices', () => {
    expect(canPerformAction(['employee'], 'invoices', 'create').granted).toBe(false);
  });
  it('employee cannot delete payroll', () => {
    expect(canPerformAction(['employee'], 'payroll', 'delete').granted).toBe(false);
  });
  it('employee can read payroll', () => {
    expect(canPerformAction(['employee'], 'payroll', 'read').granted).toBe(true);
  });
  it('employee can create in employee-dashboard', () => {
    expect(canPerformAction(['employee'], 'employee-dashboard', 'create').granted).toBe(true);
  });

  // finance boundaries
  it('finance can delete invoices (FULL)', () => {
    expect(canPerformAction(['finance'], 'invoices', 'delete').granted).toBe(true);
  });
  it('finance cannot delete employee-dashboard (only READ)', () => {
    expect(canPerformAction(['finance'], 'employee-dashboard', 'delete').granted).toBe(false);
  });

  // manager boundaries
  it('manager can create in projects (FULL)', () => {
    expect(canPerformAction(['manager'], 'projects', 'create').granted).toBe(true);
  });
  it('manager cannot delete payroll (only READ)', () => {
    expect(canPerformAction(['manager'], 'payroll', 'delete').granted).toBe(false);
  });

  // it role boundaries
  it('it can delete assets (FULL)', () => {
    expect(canPerformAction(['it'], 'assets', 'delete').granted).toBe(true);
  });
  it('it cannot delete payroll (only READ)', () => {
    expect(canPerformAction(['it'], 'payroll', 'delete').granted).toBe(false);
  });

  // empty / unknown
  it('empty roles cannot perform any action', () => {
    expect(canPerformAction([], 'projects', 'read').granted).toBe(false);
  });
  it('unknown role cannot perform any action', () => {
    expect(canPerformAction(['ghost' as any], 'invoices', 'read').granted).toBe(false);
  });

  // denial carries reason message
  it('denied action result includes reason', () => {
    const result = canPerformAction(['employee'], 'payroll', 'delete');
    expect(result.granted).toBe(false);
    expect(result.reason).toContain('delete');
  });
});

// ---------------------------------------------------------------------------
// getAccessibleApps
// ---------------------------------------------------------------------------
describe('getAccessibleApps', () => {
  it('admin gets all 17 apps', () => {
    const apps = getAccessibleApps(['admin']);
    expect(apps.length).toBe(17);
  });

  it('hr accessible apps include onboarding, recruitment, payroll, performance', () => {
    const apps = getAccessibleApps(['hr']);
    expect(apps).toContain('onboarding');
    expect(apps).toContain('recruitment');
    expect(apps).toContain('payroll');
    expect(apps).toContain('performance');
  });

  it('marketing accessible apps include linkedin and communications', () => {
    const apps = getAccessibleApps(['marketing']);
    expect(apps).toContain('linkedin');
    expect(apps).toContain('communications');
  });

  it('guest gets only apps with non-empty actions (documentation, training, communications, directory, knowledge-base)', () => {
    const apps = getAccessibleApps(['guest']);
    expect(apps).toContain('documentation');
    expect(apps).toContain('training');
    expect(apps).toContain('knowledge-base');
    expect(apps).not.toContain('payroll');
    expect(apps).not.toContain('invoices');
  });

  it('empty roles returns empty list', () => {
    expect(getAccessibleApps([])).toEqual([]);
  });

  it('unknown role returns empty list', () => {
    expect(getAccessibleApps(['phantom' as any])).toEqual([]);
  });

  it('multiple roles union their accessible apps', () => {
    const apps = getAccessibleApps(['employee', 'it']);
    expect(apps).toContain('it-services');
    expect(apps).toContain('assets');
    expect(apps).toContain('employee-dashboard');
  });
});

// ---------------------------------------------------------------------------
// getAllowedActions
// ---------------------------------------------------------------------------
describe('getAllowedActions', () => {
  it('admin gets full action set for any app', () => {
    const actions = getAllowedActions(['admin'], 'payroll');
    expect(actions).toContain('create');
    expect(actions).toContain('read');
    expect(actions).toContain('update');
    expect(actions).toContain('delete');
    expect(actions).toContain('approve');
    expect(actions).toContain('export');
  });

  it('employee on payroll gets only read', () => {
    const actions = getAllowedActions(['employee'], 'payroll');
    expect(actions).toEqual(['read']);
  });

  it('hr on invoices gets only read', () => {
    const actions = getAllowedActions(['hr'], 'invoices');
    expect(actions).toEqual(['read']);
  });

  it('finance on invoices gets full CRUD + approve + export', () => {
    const actions = getAllowedActions(['finance'], 'invoices');
    expect(actions).toContain('create');
    expect(actions).toContain('delete');
    expect(actions).toContain('approve');
  });

  it('it on it-services gets full action set', () => {
    const actions = getAllowedActions(['it'], 'it-services');
    expect(actions).toContain('create');
    expect(actions).toContain('delete');
  });

  it('empty roles returns empty actions', () => {
    expect(getAllowedActions([], 'invoices')).toEqual([]);
  });

  it('multi-role union — employee + manager on projects includes create', () => {
    const actions = getAllowedActions(['employee', 'manager'], 'projects');
    expect(actions).toContain('create');
    expect(actions).toContain('delete');
  });

  it('guest on payroll returns empty array', () => {
    const actions = getAllowedActions(['guest'], 'payroll');
    expect(actions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isAdmin
// ---------------------------------------------------------------------------
describe('isAdmin', () => {
  it('returns true for ["admin"]', () => {
    expect(isAdmin(['admin'])).toBe(true);
  });
  it('returns false for ["hr"]', () => {
    expect(isAdmin(['hr'])).toBe(false);
  });
  it('returns false for ["finance", "manager"]', () => {
    expect(isAdmin(['finance', 'manager'])).toBe(false);
  });
  it('returns false for empty array', () => {
    expect(isAdmin([])).toBe(false);
  });
  it('returns true for ["admin", "hr"] (admin present)', () => {
    expect(isAdmin(['admin', 'hr'])).toBe(true);
  });
  it('returns false for ["employee"]', () => {
    expect(isAdmin(['employee'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasAnyRole
// ---------------------------------------------------------------------------
describe('hasAnyRole', () => {
  it('true when user has one of the required roles', () => {
    expect(hasAnyRole(['hr', 'employee'], ['hr', 'finance'])).toBe(true);
  });
  it('true when user has all required roles', () => {
    expect(hasAnyRole(['hr', 'finance'], ['hr', 'finance'])).toBe(true);
  });
  it('false when no overlap', () => {
    expect(hasAnyRole(['employee'], ['admin', 'hr'])).toBe(false);
  });
  it('false when userRoles is empty', () => {
    expect(hasAnyRole([], ['admin'])).toBe(false);
  });
  it('false when requiredRoles is empty', () => {
    expect(hasAnyRole(['admin'], [])).toBe(false);
  });
  it('true for exact single match', () => {
    expect(hasAnyRole(['marketing'], ['marketing'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasAllRoles
// ---------------------------------------------------------------------------
describe('hasAllRoles', () => {
  it('true when user has all required roles', () => {
    expect(hasAllRoles(['admin', 'hr', 'finance'], ['admin', 'hr'])).toBe(true);
  });
  it('true when user has exactly the required roles', () => {
    expect(hasAllRoles(['hr', 'finance'], ['hr', 'finance'])).toBe(true);
  });
  it('false when missing one required role', () => {
    expect(hasAllRoles(['hr'], ['hr', 'finance'])).toBe(false);
  });
  it('false when user has no roles', () => {
    expect(hasAllRoles([], ['hr'])).toBe(false);
  });
  it('true when requiredRoles is empty (vacuous)', () => {
    expect(hasAllRoles(['admin'], [])).toBe(true);
  });
  it('false when user has unrelated roles only', () => {
    expect(hasAllRoles(['employee', 'marketing'], ['admin'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPrimaryRole
// ---------------------------------------------------------------------------
describe('getPrimaryRole', () => {
  it('admin wins over everything', () => {
    expect(getPrimaryRole(['employee', 'hr', 'admin'])).toBe('admin');
  });
  it('hr wins over finance', () => {
    expect(getPrimaryRole(['finance', 'hr'])).toBe('hr');
  });
  it('finance wins over manager', () => {
    expect(getPrimaryRole(['manager', 'finance'])).toBe('finance');
  });
  it('manager wins over it', () => {
    expect(getPrimaryRole(['it', 'manager'])).toBe('manager');
  });
  it('it wins over marketing', () => {
    expect(getPrimaryRole(['marketing', 'it'])).toBe('it');
  });
  it('marketing wins over employee', () => {
    expect(getPrimaryRole(['employee', 'marketing'])).toBe('marketing');
  });
  it('employee returned when only employee present', () => {
    expect(getPrimaryRole(['employee'])).toBe('employee');
  });
  it('guest returned for empty array', () => {
    expect(getPrimaryRole([])).toBe('guest');
  });
  it('guest returned for unknown role', () => {
    expect(getPrimaryRole(['unicorn' as any])).toBe('guest');
  });
  it('single admin role returns admin', () => {
    expect(getPrimaryRole(['admin'])).toBe('admin');
  });
});
