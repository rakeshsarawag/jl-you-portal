import { describe, expect, it } from "vitest";
import { getAppByPath, normalizeAppPath } from "../../../src/constants/appRegistry";

describe("app registry path lookup", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/", "/dashboard"],
    ["/defect-tracker///", "/defect-tracker"],
    ["directory/", "/directory"],
    ["/", "/"],
  ])("normalizes %s to %s", (pathname, expected) => {
    expect(normalizeAppPath(pathname)).toBe(expected);
  });

  it("resolves trailing-slash variants to the same protected app", () => {
    expect(getAppByPath("/dashboard/")).toBe(getAppByPath("/dashboard"));
    expect(getAppByPath("/defect-tracker/")?.appId).toBe("defect-tracker");
  });

  it("does not resolve unknown paths", () => {
    expect(getAppByPath("/not-an-app/")).toBeUndefined();
  });
});
