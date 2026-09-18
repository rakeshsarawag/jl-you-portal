// ── Role keys ─────────────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN: "admin",
  HR: "hr",
  MANAGER: "manager",
  EMPLOYEE: "employee",
  FINANCE: "finance",
  MARKETING: "marketing",
  IT: "it",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// ── Route → allowed roles map ─────────────────────────────────────────────────
export const ROUTE_ROLES: Record<string, Role[]> = {
  "/onboarding":                    [ROLES.ADMIN, ROLES.HR],
  "/dashboard":                     [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE],
  "/recruitment":                   [ROLES.ADMIN, ROLES.HR],
  "/performance":                   [ROLES.ADMIN, ROLES.MANAGER],
  "/documentation":                 [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE],
  "/it-services":                   [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE],
  "/invoices":                      [ROLES.ADMIN, ROLES.FINANCE],
  "/linkedin":                      [ROLES.ADMIN, ROLES.MARKETING],
  "/communications":                [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE],
  "/user-management":               [ROLES.ADMIN],
  "/permissions":                   [ROLES.ADMIN],
  "/executive-dashboard":           [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.HR],
  "/workflow-dashboard":            [ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.FINANCE],
  "/advanced-analytics":            [ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.FINANCE],
  "/security-compliance":           [ROLES.ADMIN],
  "/advanced-features":             [ROLES.ADMIN, ROLES.MANAGER],
  "/training":                      [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE],
  "/payroll":                       [ROLES.ADMIN, ROLES.HR, ROLES.FINANCE],
  "/projects":                      [ROLES.ADMIN, ROLES.MANAGER],
  "/assets":                        [ROLES.ADMIN, ROLES.IT],
  "/okr":                           [ROLES.ADMIN, ROLES.MANAGER],
  "/directory":                     [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE],
  "/master-data":                   [ROLES.ADMIN, ROLES.FINANCE, ROLES.HR],
};
