import { describe, expect, it } from "vitest";
import {
  buildOrgTree,
  type DirectoryEmployee,
} from "../../../src/app/hooks/useDirectoryData";

function employee(
  id: string,
  name: string,
  managerId = "",
): DirectoryEmployee {
  return {
    id,
    employee_code: `JL${id}`,
    name,
    email: `${id}@example.com`,
    phone: "",
    department: "Engineering",
    designation: "Engineer",
    manager_id: managerId,
    location: "Mumbai",
    join_date: "2025-01-01",
    skills: [],
    status: "Active",
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
  };
}

describe("employee directory hierarchy", () => {
  it("shows unassigned employees as roots and nests valid reports", () => {
    const tree = buildOrgTree([
      employee("001", "Manager"),
      employee("002", "Report", "001"),
      employee("003", "Unassigned"),
    ]);

    expect(tree.map(node => node.id)).toEqual(["001", "003"]);
    expect(tree[0].employee_code).toBe("JL001");
    expect(tree[0].reports.map(node => node.id)).toEqual(["002"]);
  });

  it("keeps the hierarchy renderable when manager data contains a cycle", () => {
    const tree = buildOrgTree([
      employee("001", "First", "002"),
      employee("002", "Second", "001"),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].reports).toHaveLength(1);
    expect(tree[0].reports[0].reports).toHaveLength(0);
  });

  it("ignores self-manager assignments", () => {
    const tree = buildOrgTree([employee("001", "Self Managed", "001")]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("001");
  });
});
