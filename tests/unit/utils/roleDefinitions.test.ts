import { describe, it, expect } from "vitest";
import {
  ROLE_DEFINITIONS,
  getRoleDefinition,
  getAllRoles,
  getRoleColor,
  getRoleName,
} from "../../../src/utils/rbac/roleDefinitions";

// ---------------------------------------------------------------------------
// ROLE_DEFINITIONS constant
// ---------------------------------------------------------------------------

describe("ROLE_DEFINITIONS constant — structural integrity", () => {
  const requiredRoles = ["admin", "hr", "finance", "manager", "employee", "it", "marketing", "guest"];

  it("contains all expected role keys", () => {
    for (const role of requiredRoles) {
      expect(ROLE_DEFINITIONS).toHaveProperty(role);
    }
  });

  it("every role has id, name, description, color, icon, permissions", () => {
    for (const role of Object.values(ROLE_DEFINITIONS)) {
      expect(typeof role.id).toBe("string");
      expect(typeof role.name).toBe("string");
      expect(typeof role.description).toBe("string");
      expect(typeof role.color).toBe("string");
      expect(typeof role.icon).toBe("string");
      expect(Array.isArray(role.permissions)).toBe(true);
    }
  });

  it("every role's id matches its key in ROLE_DEFINITIONS", () => {
    for (const [key, role] of Object.entries(ROLE_DEFINITIONS)) {
      expect(role.id).toBe(key);
    }
  });

  it("every permission entry has app and actions array", () => {
    for (const role of Object.values(ROLE_DEFINITIONS)) {
      for (const perm of role.permissions) {
        expect(typeof perm.app).toBe("string");
        expect(Array.isArray(perm.actions)).toBe(true);
      }
    }
  });

  it("all roles have employee-dashboard permission entry", () => {
    for (const role of Object.values(ROLE_DEFINITIONS)) {
      const hasDash = role.permissions.some((p) => p.app === "employee-dashboard");
      expect(hasDash).toBe(true);
    }
  });
});

describe("ROLE_DEFINITIONS — admin permissions", () => {
  const admin = ROLE_DEFINITIONS["admin"];

  it("admin has at least 15 app permissions", () => {
    expect(admin.permissions.length).toBeGreaterThanOrEqual(15);
  });

  it("admin has FULL actions on payroll", () => {
    const payroll = admin.permissions.find((p) => p.app === "payroll");
    expect(payroll?.actions).toContain("create");
    expect(payroll?.actions).toContain("read");
    expect(payroll?.actions).toContain("update");
    expect(payroll?.actions).toContain("delete");
    expect(payroll?.actions).toContain("approve");
    expect(payroll?.actions).toContain("export");
  });

  it("admin has FULL actions on invoices", () => {
    const invoices = admin.permissions.find((p) => p.app === "invoices");
    expect(invoices?.actions).toContain("approve");
    expect(invoices?.actions).toContain("delete");
  });

  it("admin description mentions full access", () => {
    expect(admin.description.toLowerCase()).toContain("full");
  });

  it("admin color is bg-red-500", () => {
    expect(admin.color).toBe("bg-red-500");
  });
});

describe("ROLE_DEFINITIONS — employee permissions", () => {
  const employee = ROLE_DEFINITIONS["employee"];

  it("employee has fewer app permissions than admin", () => {
    const adminCount = ROLE_DEFINITIONS["admin"].permissions.filter(
      (p) => p.actions.length > 0
    ).length;
    const empCount = employee.permissions.filter(
      (p) => p.actions.length > 0
    ).length;
    expect(empCount).toBeLessThanOrEqual(adminCount);
  });

  it("employee payroll access is read-only", () => {
    const payroll = employee.permissions.find((p) => p.app === "payroll");
    expect(payroll?.actions).toEqual(["read"]);
  });

  it("employee can read invoices", () => {
    const inv = employee.permissions.find((p) => p.app === "invoices");
    expect(inv?.actions).toContain("read");
  });

  it("employee cannot approve anything (no approve action across apps)", () => {
    for (const perm of employee.permissions) {
      expect(perm.actions).not.toContain("approve");
    }
  });

  it("employee has it-services with create access (for submitting tickets)", () => {
    const it = employee.permissions.find((p) => p.app === "it-services");
    expect(it?.actions).toContain("create");
    expect(it?.actions).toContain("read");
  });
});

describe("ROLE_DEFINITIONS — finance permissions", () => {
  it("finance has FULL actions on invoices", () => {
    const inv = ROLE_DEFINITIONS["finance"].permissions.find(
      (p) => p.app === "invoices"
    );
    expect(inv?.actions).toContain("approve");
    expect(inv?.actions).toContain("create");
    expect(inv?.actions).toContain("delete");
  });

  it("finance has FULL actions on payroll", () => {
    const payroll = ROLE_DEFINITIONS["finance"].permissions.find(
      (p) => p.app === "payroll"
    );
    expect(payroll?.actions).toContain("approve");
  });

  it("finance has only read access to recruitment", () => {
    const rec = ROLE_DEFINITIONS["finance"].permissions.find(
      (p) => p.app === "recruitment"
    );
    expect(rec?.actions).toEqual(["read"]);
  });
});

describe("ROLE_DEFINITIONS — role colors", () => {
  const expectedColors: Record<string, string> = {
    admin: "bg-red-500",
    hr: "bg-blue-500",
    finance: "bg-green-500",
    manager: "bg-purple-500",
    employee: "bg-cyan-500",
    it: "bg-indigo-500",
    marketing: "bg-pink-500",
    guest: "bg-gray-500",
  };

  for (const [role, color] of Object.entries(expectedColors)) {
    it(`${role} has color ${color}`, () => {
      expect(ROLE_DEFINITIONS[role].color).toBe(color);
    });
  }
});

// ---------------------------------------------------------------------------
// getRoleDefinition
// ---------------------------------------------------------------------------

describe("getRoleDefinition", () => {
  it("returns admin definition", () => {
    const def = getRoleDefinition("admin");
    expect(def).toBeDefined();
    expect(def?.id).toBe("admin");
    expect(def?.name).toBe("Administrator");
  });

  it("returns hr definition", () => {
    const def = getRoleDefinition("hr");
    expect(def?.id).toBe("hr");
    expect(def?.name).toBe("HR Manager");
  });

  it("returns finance definition", () => {
    const def = getRoleDefinition("finance");
    expect(def?.id).toBe("finance");
  });

  it("returns manager definition", () => {
    const def = getRoleDefinition("manager");
    expect(def?.id).toBe("manager");
  });

  it("returns employee definition", () => {
    const def = getRoleDefinition("employee");
    expect(def?.id).toBe("employee");
  });

  it("returns it definition", () => {
    const def = getRoleDefinition("it");
    expect(def?.id).toBe("it");
    expect(def?.name).toBe("IT Administrator");
  });

  it("returns marketing definition", () => {
    const def = getRoleDefinition("marketing");
    expect(def?.id).toBe("marketing");
  });

  it("returns guest definition", () => {
    const def = getRoleDefinition("guest");
    expect(def?.id).toBe("guest");
  });

  it("returns undefined for unknown role id", () => {
    expect(getRoleDefinition("unknown-role")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getRoleDefinition("")).toBeUndefined();
  });

  it("returned object has all required fields", () => {
    const def = getRoleDefinition("admin");
    expect(def).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      description: expect.any(String),
      color: expect.any(String),
      icon: expect.any(String),
      permissions: expect.any(Array),
    });
  });
});

// ---------------------------------------------------------------------------
// getAllRoles
// ---------------------------------------------------------------------------

describe("getAllRoles", () => {
  it("returns an array", () => {
    expect(Array.isArray(getAllRoles())).toBe(true);
  });

  it("returns at least 7 roles", () => {
    expect(getAllRoles().length).toBeGreaterThanOrEqual(7);
  });

  it("all returned items have id, name, description, permissions", () => {
    for (const role of getAllRoles()) {
      expect(role.id).toBeTruthy();
      expect(role.name).toBeTruthy();
      expect(role.description).toBeTruthy();
      expect(Array.isArray(role.permissions)).toBe(true);
    }
  });

  it("includes admin, hr, finance, manager, employee, it, marketing", () => {
    const ids = getAllRoles().map((r) => r.id);
    for (const expected of ["admin", "hr", "finance", "manager", "employee", "it", "marketing"]) {
      expect(ids).toContain(expected);
    }
  });

  it("returns same count as ROLE_DEFINITIONS keys", () => {
    expect(getAllRoles().length).toBe(Object.keys(ROLE_DEFINITIONS).length);
  });
});

// ---------------------------------------------------------------------------
// getRoleColor
// ---------------------------------------------------------------------------

describe("getRoleColor", () => {
  it("returns bg-red-500 for admin", () => {
    expect(getRoleColor("admin")).toBe("bg-red-500");
  });

  it("returns bg-blue-500 for hr", () => {
    expect(getRoleColor("hr")).toBe("bg-blue-500");
  });

  it("returns bg-green-500 for finance", () => {
    expect(getRoleColor("finance")).toBe("bg-green-500");
  });

  it("returns bg-purple-500 for manager", () => {
    expect(getRoleColor("manager")).toBe("bg-purple-500");
  });

  it("returns bg-cyan-500 for employee", () => {
    expect(getRoleColor("employee")).toBe("bg-cyan-500");
  });

  it("returns bg-indigo-500 for it", () => {
    expect(getRoleColor("it")).toBe("bg-indigo-500");
  });

  it("returns bg-pink-500 for marketing", () => {
    expect(getRoleColor("marketing")).toBe("bg-pink-500");
  });

  it("returns bg-gray-500 for guest", () => {
    expect(getRoleColor("guest")).toBe("bg-gray-500");
  });

  it("returns bg-gray-500 (fallback) for unknown role", () => {
    expect(getRoleColor("nonexistent")).toBe("bg-gray-500");
  });

  it("returns a string starting with bg- for every defined role", () => {
    for (const role of Object.keys(ROLE_DEFINITIONS)) {
      expect(getRoleColor(role)).toMatch(/^bg-/);
    }
  });
});

// ---------------------------------------------------------------------------
// getRoleName
// ---------------------------------------------------------------------------

describe("getRoleName", () => {
  it("returns Administrator for admin", () => {
    expect(getRoleName("admin")).toBe("Administrator");
  });

  it("returns HR Manager for hr", () => {
    expect(getRoleName("hr")).toBe("HR Manager");
  });

  it("returns Finance Manager for finance", () => {
    expect(getRoleName("finance")).toBe("Finance Manager");
  });

  it("returns Manager for manager", () => {
    expect(getRoleName("manager")).toBe("Manager");
  });

  it("returns Employee for employee", () => {
    expect(getRoleName("employee")).toBe("Employee");
  });

  it("returns IT Administrator for it", () => {
    expect(getRoleName("it")).toBe("IT Administrator");
  });

  it("returns Marketing Manager for marketing", () => {
    expect(getRoleName("marketing")).toBe("Marketing Manager");
  });

  it("returns Guest for guest", () => {
    expect(getRoleName("guest")).toBe("Guest");
  });

  it("returns Unknown Role fallback for unrecognized id", () => {
    expect(getRoleName("totally-unknown")).toBe("Unknown Role");
  });

  it("returns non-empty string for all defined roles", () => {
    for (const role of Object.keys(ROLE_DEFINITIONS)) {
      expect(getRoleName(role).length).toBeGreaterThan(0);
    }
  });
});
