import { describe, it, expect } from "vitest";

// RBAC permission matrix logic tested standalone

type Role = "admin" | "hr" | "manager" | "finance" | "employee" | "it" | "marketing";

interface PermissionMatrix {
  [appId: string]: Role[];
}

// Default permission matrix (mirrors usePermissions hook logic)
const DEFAULT_MATRIX: PermissionMatrix = {
  "employee-directory":   ["admin", "hr", "manager"],
  "payroll":              ["admin", "hr", "finance"],
  "recruitment":          ["admin", "hr"],
  "performance":          ["admin", "hr", "manager", "employee"],
  "leave":                ["admin", "hr", "manager", "employee"],
  "assets":               ["admin", "it"],
  "invoices":             ["admin", "finance"],
  "audit-logs":           ["admin"],
  "user-management":      ["admin"],
  "it-helpdesk":          ["admin", "it", "employee"],
  "analytics":            ["admin", "hr", "finance", "manager"],
  "linkedin":             ["admin", "marketing"],
};

function canSeeApp(role: Role, appId: string, matrix: PermissionMatrix = DEFAULT_MATRIX): boolean {
  return matrix[appId]?.includes(role) ?? false;
}

function getAccessibleApps(role: Role, matrix: PermissionMatrix = DEFAULT_MATRIX): string[] {
  return Object.keys(matrix).filter(appId => canSeeApp(role, appId, matrix));
}

function hasPermission(roles: Role[], appId: string, matrix: PermissionMatrix = DEFAULT_MATRIX): boolean {
  return roles.some(r => canSeeApp(r, appId, matrix));
}

function applyOverrides(
  base: PermissionMatrix,
  overrides: { appId: string; granted: boolean }[],
  role: Role,
): PermissionMatrix {
  const result = { ...base };
  for (const { appId, granted } of overrides) {
    if (granted && !result[appId]?.includes(role)) {
      result[appId] = [...(result[appId] ?? []), role];
    } else if (!granted) {
      result[appId] = (result[appId] ?? []).filter(r => r !== role);
    }
  }
  return result;
}

describe("canSeeApp — admin", () => {
  it("admin can see audit-logs", () => expect(canSeeApp("admin", "audit-logs")).toBe(true));
  it("admin can see payroll", () => expect(canSeeApp("admin", "payroll")).toBe(true));
  it("admin can see user-management", () => expect(canSeeApp("admin", "user-management")).toBe(true));
});

describe("canSeeApp — hr", () => {
  it("hr can see employee-directory", () => expect(canSeeApp("hr", "employee-directory")).toBe(true));
  it("hr can see recruitment", () => expect(canSeeApp("hr", "recruitment")).toBe(true));
  it("hr cannot see audit-logs", () => expect(canSeeApp("hr", "audit-logs")).toBe(false));
  it("hr cannot see invoices", () => expect(canSeeApp("hr", "invoices")).toBe(false));
});

describe("canSeeApp — employee", () => {
  it("employee can see leave", () => expect(canSeeApp("employee", "leave")).toBe(true));
  it("employee can see performance", () => expect(canSeeApp("employee", "performance")).toBe(true));
  it("employee cannot see payroll", () => expect(canSeeApp("employee", "payroll")).toBe(false));
  it("employee cannot see recruitment", () => expect(canSeeApp("employee", "recruitment")).toBe(false));
  it("employee cannot see audit-logs", () => expect(canSeeApp("employee", "audit-logs")).toBe(false));
});

describe("canSeeApp — finance", () => {
  it("finance can see payroll", () => expect(canSeeApp("finance", "payroll")).toBe(true));
  it("finance can see invoices", () => expect(canSeeApp("finance", "invoices")).toBe(true));
  it("finance cannot see recruitment", () => expect(canSeeApp("finance", "recruitment")).toBe(false));
});

describe("canSeeApp — it", () => {
  it("it can see assets", () => expect(canSeeApp("it", "assets")).toBe(true));
  it("it can see it-helpdesk", () => expect(canSeeApp("it", "it-helpdesk")).toBe(true));
  it("it cannot see payroll", () => expect(canSeeApp("it", "payroll")).toBe(false));
});

describe("canSeeApp — marketing", () => {
  it("marketing can see linkedin", () => expect(canSeeApp("marketing", "linkedin")).toBe(true));
  it("marketing cannot see payroll", () => expect(canSeeApp("marketing", "payroll")).toBe(false));
});

describe("getAccessibleApps", () => {
  it("employee gets leave, performance, it-helpdesk", () => {
    const apps = getAccessibleApps("employee");
    expect(apps).toContain("leave");
    expect(apps).toContain("performance");
    expect(apps).toContain("it-helpdesk");
    expect(apps).not.toContain("payroll");
    expect(apps).not.toContain("audit-logs");
  });

  it("admin gets all apps", () => {
    const apps = getAccessibleApps("admin");
    expect(apps.length).toBe(Object.keys(DEFAULT_MATRIX).length);
  });
});

describe("hasPermission (multi-role)", () => {
  it("grants access if any role has permission", () => {
    expect(hasPermission(["employee", "manager"], "employee-directory")).toBe(true);
  });

  it("denies if no role has permission", () => {
    expect(hasPermission(["employee", "marketing"], "audit-logs")).toBe(false);
  });

  it("empty roles array denies all", () => {
    expect(hasPermission([], "leave")).toBe(false);
  });
});

describe("applyOverrides", () => {
  it("grants additional app access via override", () => {
    const matrix = applyOverrides(DEFAULT_MATRIX, [{ appId: "audit-logs", granted: true }], "hr");
    expect(canSeeApp("hr", "audit-logs", matrix)).toBe(true);
  });

  it("revokes existing access via override", () => {
    const matrix = applyOverrides(DEFAULT_MATRIX, [{ appId: "leave", granted: false }], "employee");
    expect(canSeeApp("employee", "leave", matrix)).toBe(false);
  });

  it("does not affect other roles", () => {
    const matrix = applyOverrides(DEFAULT_MATRIX, [{ appId: "audit-logs", granted: true }], "hr");
    expect(canSeeApp("admin", "audit-logs", matrix)).toBe(true);
    expect(canSeeApp("manager", "audit-logs", matrix)).toBe(false);
  });
});
