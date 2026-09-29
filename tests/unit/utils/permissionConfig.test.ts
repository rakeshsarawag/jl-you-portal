import { describe, it, expect } from "vitest";
import {
  APP_FEATURES,
  DEFAULT_PERMISSION_MATRIX,
  hasFeaturePermission,
  getUserAppPermissions,
} from "../../../src/utils/rbac/permissionConfig";

// ---------------------------------------------------------------------------
// APP_FEATURES constant
// ---------------------------------------------------------------------------

describe("APP_FEATURES constant", () => {
  const expectedApps = [
    "onboarding",
    "dashboard",
    "recruitment",
    "performance",
    "documentation",
    "it-services",
    "training",
    "invoices",
    "linkedin",
    "master-data",
    "payroll",
    "projects",
    "communications",
    "assets",
    "okr",
    "directory",
    "knowledge",
  ];

  it("contains all expected application keys", () => {
    for (const app of expectedApps) {
      expect(APP_FEATURES).toHaveProperty(app);
    }
  });

  it("every app has a non-empty features array", () => {
    for (const app of expectedApps) {
      const features = APP_FEATURES[app as keyof typeof APP_FEATURES];
      expect(Array.isArray(features)).toBe(true);
      expect(features.length).toBeGreaterThan(0);
    }
  });

  it("every feature has required shape (feature, label, description, actions)", () => {
    for (const [, features] of Object.entries(APP_FEATURES)) {
      for (const f of features) {
        expect(typeof f.feature).toBe("string");
        expect(typeof f.label).toBe("string");
        expect(typeof f.description).toBe("string");
        expect(Array.isArray(f.actions)).toBe(true);
        expect(f.actions.length).toBeGreaterThan(0);
      }
    }
  });

  it("invoices app has an approve feature", () => {
    const inv = APP_FEATURES["invoices"];
    const approveFeature = inv.find((f) => f.feature === "approve");
    expect(approveFeature).toBeDefined();
    expect(approveFeature?.actions).toContain("approve");
  });

  it("payroll app has payroll and salaries features", () => {
    const features = APP_FEATURES["payroll"].map((f) => f.feature);
    expect(features).toContain("payroll");
    expect(features).toContain("salaries");
  });

  it("recruitment app includes approve action on jobs feature", () => {
    const jobsFeature = APP_FEATURES["recruitment"].find(
      (f) => f.feature === "jobs"
    );
    expect(jobsFeature?.actions).toContain("approve");
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_PERMISSION_MATRIX constant
// ---------------------------------------------------------------------------

describe("DEFAULT_PERMISSION_MATRIX constant", () => {
  it("contains all expected roles", () => {
    const roles = ["admin", "hr", "finance", "manager", "employee", "it", "marketing", "guest"];
    for (const role of roles) {
      expect(DEFAULT_PERMISSION_MATRIX).toHaveProperty(role);
    }
  });

  it("admin has permissions for all APP_FEATURES apps", () => {
    const adminPerms = DEFAULT_PERMISSION_MATRIX["admin"];
    for (const appId of Object.keys(APP_FEATURES)) {
      expect(adminPerms).toHaveProperty(appId);
    }
  });

  it("admin payroll permissions include create, read, update, approve", () => {
    const payrollPerms = DEFAULT_PERMISSION_MATRIX["admin"]["payroll"];
    expect(payrollPerms["payroll"]).toContain("create");
    expect(payrollPerms["payroll"]).toContain("read");
    expect(payrollPerms["payroll"]).toContain("update");
    expect(payrollPerms["approve"]).toContain("approve");
  });

  it("employee has dashboard permissions", () => {
    expect(DEFAULT_PERMISSION_MATRIX["employee"]).toHaveProperty("dashboard");
  });

  it("employee dashboard view only allows read", () => {
    expect(DEFAULT_PERMISSION_MATRIX["employee"]["dashboard"]["view"]).toEqual(["read"]);
  });

  it("employee cannot access payroll features (no payroll key)", () => {
    expect(DEFAULT_PERMISSION_MATRIX["employee"]).not.toHaveProperty("payroll");
  });

  it("finance has full invoices permissions", () => {
    const financeInv = DEFAULT_PERMISSION_MATRIX["finance"]["invoices"];
    expect(financeInv["invoices"]).toContain("create");
    expect(financeInv["invoices"]).toContain("read");
    expect(financeInv["invoices"]).toContain("update");
    expect(financeInv["invoices"]).toContain("delete");
    expect(financeInv["approve"]).toContain("approve");
  });

  it("hr payroll access is read-only (no create/approve)", () => {
    const hrPayroll = DEFAULT_PERMISSION_MATRIX["hr"]["payroll"];
    expect(hrPayroll["payroll"]).toEqual(["read"]);
    expect(hrPayroll["payroll"]).not.toContain("create");
    expect(hrPayroll["payroll"]).not.toContain("approve");
  });

  it("guest has no onboarding permissions", () => {
    expect(DEFAULT_PERMISSION_MATRIX["guest"]).not.toHaveProperty("onboarding");
  });

  it("guest documentation is read-only", () => {
    expect(DEFAULT_PERMISSION_MATRIX["guest"]["documentation"]["articles"]).toEqual(["read"]);
  });
});

// ---------------------------------------------------------------------------
// hasFeaturePermission
// ---------------------------------------------------------------------------

describe("hasFeaturePermission — admin always gets access", () => {
  it("admin can read any feature in any app", () => {
    expect(hasFeaturePermission(["admin"], "payroll", "payroll", "read")).toBe(true);
  });

  it("admin can delete in onboarding", () => {
    expect(hasFeaturePermission(["admin"], "onboarding", "employees", "delete")).toBe(true);
  });

  it("admin can approve invoices", () => {
    expect(hasFeaturePermission(["admin"], "invoices", "approve", "approve")).toBe(true);
  });

  it("admin can export from any module", () => {
    expect(hasFeaturePermission(["admin"], "payroll", "reports", "export")).toBe(true);
  });

  it("admin can approve payroll", () => {
    expect(hasFeaturePermission(["admin"], "payroll", "approve", "approve")).toBe(true);
  });
});

describe("hasFeaturePermission — employee restrictions", () => {
  it("employee can read dashboard view", () => {
    expect(hasFeaturePermission(["employee"], "dashboard", "view", "read")).toBe(true);
  });

  it("employee can create IT tickets", () => {
    expect(hasFeaturePermission(["employee"], "it-services", "tickets", "create")).toBe(true);
  });

  it("employee cannot delete IT tickets", () => {
    expect(hasFeaturePermission(["employee"], "it-services", "tickets", "delete")).toBe(false);
  });

  it("employee cannot access payroll at all", () => {
    expect(hasFeaturePermission(["employee"], "payroll", "payroll", "read")).toBe(false);
  });

  it("employee cannot approve anything", () => {
    expect(hasFeaturePermission(["employee"], "invoices", "approve", "approve")).toBe(false);
  });

  it("employee cannot delete projects", () => {
    expect(hasFeaturePermission(["employee"], "projects", "projects", "delete")).toBe(false);
  });

  it("employee can read projects", () => {
    expect(hasFeaturePermission(["employee"], "projects", "projects", "read")).toBe(true);
  });
});

describe("hasFeaturePermission — finance role", () => {
  it("finance can approve invoices", () => {
    expect(hasFeaturePermission(["finance"], "invoices", "approve", "approve")).toBe(true);
  });

  it("finance can create invoices", () => {
    expect(hasFeaturePermission(["finance"], "invoices", "invoices", "create")).toBe(true);
  });

  it("finance can read invoice reports", () => {
    expect(hasFeaturePermission(["finance"], "invoices", "reports", "read")).toBe(true);
  });

  it("finance can approve payroll", () => {
    expect(hasFeaturePermission(["finance"], "payroll", "approve", "approve")).toBe(true);
  });

  it("finance can read and update salaries", () => {
    expect(hasFeaturePermission(["finance"], "payroll", "salaries", "read")).toBe(true);
    expect(hasFeaturePermission(["finance"], "payroll", "salaries", "update")).toBe(true);
  });

  it("finance cannot delete payroll salaries", () => {
    expect(hasFeaturePermission(["finance"], "payroll", "salaries", "delete")).toBe(false);
  });

  it("finance cannot access onboarding tasks", () => {
    expect(hasFeaturePermission(["finance"], "onboarding", "tasks", "create")).toBe(false);
  });
});

describe("hasFeaturePermission — HR role", () => {
  it("hr can read payroll", () => {
    expect(hasFeaturePermission(["hr"], "payroll", "payroll", "read")).toBe(true);
  });

  it("hr cannot delete payroll records", () => {
    expect(hasFeaturePermission(["hr"], "payroll", "payroll", "delete")).toBe(false);
  });

  it("hr cannot approve payroll", () => {
    expect(hasFeaturePermission(["hr"], "payroll", "approve", "approve")).toBe(false);
  });

  it("hr can fully manage onboarding tasks", () => {
    expect(hasFeaturePermission(["hr"], "onboarding", "tasks", "create")).toBe(true);
    expect(hasFeaturePermission(["hr"], "onboarding", "tasks", "delete")).toBe(true);
  });

  it("hr can approve recruitment jobs", () => {
    expect(hasFeaturePermission(["hr"], "recruitment", "jobs", "approve")).toBe(true);
  });
});

describe("hasFeaturePermission — multi-role user", () => {
  it("employee+finance can approve invoices via finance role", () => {
    expect(hasFeaturePermission(["employee", "finance"], "invoices", "approve", "approve")).toBe(true);
  });

  it("employee+manager can approve performance reviews", () => {
    expect(hasFeaturePermission(["employee", "manager"], "performance", "reviews", "approve")).toBe(true);
  });

  it("unknown role with no valid roles returns false", () => {
    expect(hasFeaturePermission(["guest"], "payroll", "payroll", "read")).toBe(false);
  });

  it("empty roles array returns false", () => {
    expect(hasFeaturePermission([], "dashboard", "view", "read")).toBe(false);
  });

  it("custom matrix is used when provided", () => {
    const customMatrix = {
      employee: {
        payroll: {
          payroll: ["read" as const],
        },
      },
    };
    expect(hasFeaturePermission(["employee"], "payroll", "payroll", "read", customMatrix)).toBe(true);
  });
});

describe("hasFeaturePermission — IT role", () => {
  it("it can delete IT tickets", () => {
    expect(hasFeaturePermission(["it"], "it-services", "tickets", "delete")).toBe(true);
  });

  it("it can approve ticket resolutions", () => {
    expect(hasFeaturePermission(["it"], "it-services", "resolve", "approve")).toBe(true);
  });

  it("it cannot access payroll", () => {
    expect(hasFeaturePermission(["it"], "payroll", "payroll", "read")).toBe(false);
  });

  it("it can manage assets", () => {
    expect(hasFeaturePermission(["it"], "assets", "assets", "create")).toBe(true);
    expect(hasFeaturePermission(["it"], "assets", "assets", "delete")).toBe(true);
  });
});

describe("hasFeaturePermission — marketing role", () => {
  it("marketing can create linkedin posts", () => {
    expect(hasFeaturePermission(["marketing"], "linkedin", "posts", "create")).toBe(true);
  });

  it("marketing cannot access payroll", () => {
    expect(hasFeaturePermission(["marketing"], "payroll", "payroll", "read")).toBe(false);
  });

  it("marketing cannot access onboarding", () => {
    expect(hasFeaturePermission(["marketing"], "onboarding", "tasks", "read")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getUserAppPermissions
// ---------------------------------------------------------------------------

describe("getUserAppPermissions", () => {
  it("admin gets all features for payroll", () => {
    const perms = getUserAppPermissions(["admin"], "payroll");
    expect(perms).toHaveProperty("payroll");
    expect(perms).toHaveProperty("approve");
    expect(perms).toHaveProperty("salaries");
    expect(perms).toHaveProperty("deductions");
    expect(perms).toHaveProperty("reports");
  });

  it("admin gets all actions for every feature in payroll", () => {
    const perms = getUserAppPermissions(["admin"], "payroll");
    // Admin shortcut reads directly from APP_FEATURES
    const allFeatures = APP_FEATURES["payroll"].map((f) => f.feature);
    for (const feat of allFeatures) {
      expect(perms).toHaveProperty(feat);
    }
  });

  it("finance gets invoices features with correct actions", () => {
    const perms = getUserAppPermissions(["finance"], "invoices");
    expect(perms["invoices"]).toContain("create");
    expect(perms["invoices"]).toContain("delete");
    expect(perms["approve"]).toContain("approve");
    expect(perms["reports"]).toContain("export");
  });

  it("hr gets limited payroll permissions (read-only payroll feature)", () => {
    const perms = getUserAppPermissions(["hr"], "payroll");
    expect(perms["payroll"]).toContain("read");
    expect(perms["payroll"]).not.toContain("create");
    expect(perms["payroll"]).not.toContain("delete");
  });

  it("employee has no payroll permissions (empty object)", () => {
    const perms = getUserAppPermissions(["employee"], "payroll");
    expect(Object.keys(perms).length).toBe(0);
  });

  it("multi-role user gets union of permissions", () => {
    // hr can read payroll; finance can create/update payroll
    const perms = getUserAppPermissions(["hr", "finance"], "payroll");
    expect(perms["payroll"]).toContain("read");
    expect(perms["payroll"]).toContain("create");
    expect(perms["approve"]).toContain("approve");
  });

  it("empty roles returns empty object", () => {
    const perms = getUserAppPermissions([], "invoices");
    expect(Object.keys(perms).length).toBe(0);
  });

  it("guest documentation permissions only include read", () => {
    const perms = getUserAppPermissions(["guest"], "documentation");
    expect(perms["articles"]).toEqual(["read"]);
    expect(perms["articles"]).not.toContain("create");
  });

  it("custom matrix is respected", () => {
    const customMatrix = {
      employee: {
        payroll: {
          payroll: ["read" as const],
        },
      },
    };
    const perms = getUserAppPermissions(["employee"], "payroll", customMatrix);
    expect(perms["payroll"]).toContain("read");
  });
});
