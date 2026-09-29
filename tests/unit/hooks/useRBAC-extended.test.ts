import { describe, it, expect } from "vitest";
import {
  canAccessApp,
  canPerformAction,
  getAccessibleApps,
  getAllowedActions,
  isAdmin,
  hasAnyRole,
  getPrimaryRole,
} from "../../../src/utils/rbac/permissionChecker";
import type { UserRole, ApplicationId, PermissionAction } from "../../../src/types/rbac";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function roles(...r: string[]): UserRole[] {
  return r as UserRole[];
}

// ---------------------------------------------------------------------------
// IT role permissions
// ---------------------------------------------------------------------------
describe("IT role — it-services (FULL access)", () => {
  const itRoles = roles("it");

  it("IT can read it-services", () => {
    expect(canPerformAction(itRoles, "it-services", "read").granted).toBe(true);
  });

  it("IT can create it-services tickets", () => {
    expect(canPerformAction(itRoles, "it-services", "create").granted).toBe(true);
  });

  it("IT can update it-services tickets", () => {
    expect(canPerformAction(itRoles, "it-services", "update").granted).toBe(true);
  });

  it("IT can delete it-services tickets", () => {
    expect(canPerformAction(itRoles, "it-services", "delete").granted).toBe(true);
  });

  it("IT can approve in it-services", () => {
    expect(canPerformAction(itRoles, "it-services", "approve").granted).toBe(true);
  });

  it("IT can access assets app", () => {
    expect(canAccessApp(itRoles, "assets").granted).toBe(true);
  });

  it("IT has FULL access to assets", () => {
    const actions = getAllowedActions(itRoles, "assets");
    (["read", "create", "update", "delete"] as PermissionAction[]).forEach(a => {
      expect(actions).toContain(a);
    });
  });

  it("IT cannot access invoices beyond read", () => {
    expect(canPerformAction(itRoles, "invoices", "create").granted).toBe(false);
    expect(canPerformAction(itRoles, "invoices", "delete").granted).toBe(false);
  });

  it("IT cannot access payroll beyond read", () => {
    expect(canPerformAction(itRoles, "payroll", "create").granted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Finance role permissions
// ---------------------------------------------------------------------------
describe("Finance role — invoices (FULL access)", () => {
  const finRoles = roles("finance");

  it("finance can read invoices", () => {
    expect(canPerformAction(finRoles, "invoices", "read").granted).toBe(true);
  });

  it("finance can create invoices", () => {
    expect(canPerformAction(finRoles, "invoices", "create").granted).toBe(true);
  });

  it("finance can approve invoices", () => {
    expect(canPerformAction(finRoles, "invoices", "approve").granted).toBe(true);
  });

  it("finance can export invoices", () => {
    expect(canPerformAction(finRoles, "invoices", "export").granted).toBe(true);
  });

  it("finance can access payroll", () => {
    expect(canAccessApp(finRoles, "payroll").granted).toBe(true);
  });

  it("finance can create payroll entries", () => {
    expect(canPerformAction(finRoles, "payroll", "create").granted).toBe(true);
  });

  it("finance cannot access linkedin beyond read", () => {
    expect(canPerformAction(finRoles, "linkedin", "create").granted).toBe(false);
    expect(canPerformAction(finRoles, "linkedin", "delete").granted).toBe(false);
  });

  it("finance cannot access recruitment beyond read", () => {
    expect(canPerformAction(finRoles, "recruitment", "create").granted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Marketing role permissions
// ---------------------------------------------------------------------------
describe("Marketing role — linkedin (FULL access)", () => {
  const mktRoles = roles("marketing");

  it("marketing can read linkedin posts", () => {
    expect(canPerformAction(mktRoles, "linkedin", "read").granted).toBe(true);
  });

  it("marketing can create linkedin posts", () => {
    expect(canPerformAction(mktRoles, "linkedin", "create").granted).toBe(true);
  });

  it("marketing can update linkedin posts", () => {
    expect(canPerformAction(mktRoles, "linkedin", "update").granted).toBe(true);
  });

  it("marketing can delete linkedin posts", () => {
    expect(canPerformAction(mktRoles, "linkedin", "delete").granted).toBe(true);
  });

  it("marketing can approve linkedin posts", () => {
    expect(canPerformAction(mktRoles, "linkedin", "approve").granted).toBe(true);
  });

  it("marketing can access communications", () => {
    expect(canAccessApp(mktRoles, "communications").granted).toBe(true);
  });

  it("marketing cannot access payroll beyond read", () => {
    expect(canPerformAction(mktRoles, "payroll", "create").granted).toBe(false);
    expect(canPerformAction(mktRoles, "payroll", "approve").granted).toBe(false);
  });

  it("marketing cannot access assets beyond read", () => {
    expect(canPerformAction(mktRoles, "assets", "create").granted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Null / undefined / empty roles
// ---------------------------------------------------------------------------
describe("hasPermission for null/undefined/empty roles", () => {
  it("empty roles array — canAccessApp returns false", () => {
    expect(canAccessApp([], "invoices").granted).toBe(false);
  });

  it("empty roles array — canPerformAction returns false", () => {
    expect(canPerformAction([], "invoices", "read").granted).toBe(false);
  });

  it("empty roles — getAccessibleApps returns empty array", () => {
    expect(getAccessibleApps([])).toEqual([]);
  });

  it("empty roles — getAllowedActions returns empty array", () => {
    expect(getAllowedActions([], "invoices")).toEqual([]);
  });

  it("unknown role string — canAccessApp returns false", () => {
    expect(canAccessApp(["unknown_role"] as UserRole[], "invoices").granted).toBe(false);
  });

  it("unknown role string — canPerformAction returns false", () => {
    expect(canPerformAction(["unknown_role"] as UserRole[], "invoices", "read").granted).toBe(false);
  });

  it("isAdmin with empty roles returns false", () => {
    expect(isAdmin([])).toBe(false);
  });

  it("hasAnyRole with empty roles returns false", () => {
    expect(hasAnyRole([], ["admin", "hr"] as UserRole[])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Admin role — always granted
// ---------------------------------------------------------------------------
describe("Admin role — all permissions granted", () => {
  const adminRoles = roles("admin");

  it("admin can access any app", () => {
    const apps: ApplicationId[] = ["invoices", "payroll", "linkedin", "assets", "it-services"];
    apps.forEach(app => {
      expect(canAccessApp(adminRoles, app).granted).toBe(true);
    });
  });

  it("admin can perform any action on any app", () => {
    const actions: PermissionAction[] = ["create", "read", "update", "delete", "approve", "export"];
    actions.forEach(action => {
      expect(canPerformAction(adminRoles, "invoices", action).granted).toBe(true);
    });
  });

  it("isAdmin returns true for admin role", () => {
    expect(isAdmin(adminRoles)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Multi-role scenarios (permission unions)
// ---------------------------------------------------------------------------
describe("Multi-role permission unions", () => {
  it("employee + finance inherits finance permissions on invoices", () => {
    const combined = roles("employee", "finance");
    expect(canPerformAction(combined, "invoices", "create").granted).toBe(true);
  });

  it("marketing + it gains both linkedin and asset full access", () => {
    const combined = roles("marketing", "it");
    expect(canPerformAction(combined, "linkedin", "create").granted).toBe(true);
    expect(canPerformAction(combined, "assets", "delete").granted).toBe(true);
  });

  it("hasAnyRole matches when one of multiple roles matches", () => {
    const combined = roles("employee", "finance");
    expect(hasAnyRole(combined, ["finance", "hr"] as UserRole[])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPrimaryRole
// ---------------------------------------------------------------------------
describe("getPrimaryRole", () => {
  it("returns the first role in the list", () => {
    const primary = getPrimaryRole(roles("finance", "employee"));
    expect(primary).toBe("finance");
  });

  it("returns 'guest' for empty roles list", () => {
    const primary = getPrimaryRole([]);
    expect(primary).toBe("guest");
  });
});

// ---------------------------------------------------------------------------
// Denial reasons
// ---------------------------------------------------------------------------
describe("Denial reason messages", () => {
  it("canAccessApp denial includes a reason string for guest", () => {
    const result = canAccessApp(roles("guest"), "payroll");
    expect(result.granted).toBe(false);
    expect(typeof result.reason).toBe("string");
    expect(result.reason!.length).toBeGreaterThan(0);
  });

  it("canPerformAction denial includes a reason string", () => {
    const result = canPerformAction(roles("employee"), "invoices", "create");
    expect(result.granted).toBe(false);
    expect(typeof result.reason).toBe("string");
  });
});
