/**
 * Unit tests for RBAC utility
 */
import { describe, it, expect } from "vitest";
import { ROUTE_ROLES, ROLES } from "../../../src/constants/roles";

describe("ROUTE_ROLES access control", () => {
  it("only admin can access /user-management", () => {
    const allowed = ROUTE_ROLES["/user-management"];
    expect(allowed).toContain(ROLES.ADMIN);
    expect(allowed).not.toContain(ROLES.EMPLOYEE);
    expect(allowed).not.toContain(ROLES.MANAGER);
  });

  it("only admin and hr can access /recruitment", () => {
    const allowed = ROUTE_ROLES["/recruitment"];
    expect(allowed).toContain(ROLES.ADMIN);
    expect(allowed).toContain(ROLES.HR);
    expect(allowed).not.toContain(ROLES.EMPLOYEE);
    expect(allowed).not.toContain(ROLES.FINANCE);
  });

  it("employees can access /dashboard", () => {
    const allowed = ROUTE_ROLES["/dashboard"];
    expect(allowed).toContain(ROLES.EMPLOYEE);
    expect(allowed).toContain(ROLES.MANAGER);
  });

  it("only admin and finance can access /invoices", () => {
    const allowed = ROUTE_ROLES["/invoices"];
    expect(allowed).toContain(ROLES.ADMIN);
    expect(allowed).toContain(ROLES.FINANCE);
    expect(allowed).not.toContain(ROLES.HR);
    expect(allowed).not.toContain(ROLES.EMPLOYEE);
  });

  it("only admin and it can access /assets", () => {
    const allowed = ROUTE_ROLES["/assets"];
    expect(allowed).toContain(ROLES.ADMIN);
    expect(allowed).toContain(ROLES.IT);
    expect(allowed).not.toContain(ROLES.EMPLOYEE);
  });
});
