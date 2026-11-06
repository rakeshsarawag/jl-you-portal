import { describe, expect, it } from "vitest";
import {
  formatCompactCandidateExperience,
  formatCandidateExperience,
  parseCandidateExperience,
} from "../../../src/app/utils/recruitmentExperience";

describe("parseCandidateExperience", () => {
  it("interprets the decimal portion as months", () => {
    expect(parseCandidateExperience("6.2")).toEqual({
      years: 6,
      months: 2,
      decimalYears: 6.17,
    });
    expect(parseCandidateExperience(9.5)).toEqual({
      years: 9,
      months: 5,
      decimalYears: 9.42,
    });
  });

  it("treats zero and fresher labels as no experience", () => {
    expect(parseCandidateExperience(0).decimalYears).toBe(0);
    expect(parseCandidateExperience("Fresher").decimalYears).toBe(0);
  });

  it("accepts explicit years and months", () => {
    expect(parseCandidateExperience("3 years 11 months").decimalYears).toBe(3.92);
  });

  it("rejects invalid month values", () => {
    expect(() => parseCandidateExperience("4.12")).toThrow(
      "Experience months must be between 0 and 11",
    );
  });
});

describe("formatCandidateExperience", () => {
  it("formats stored decimal years as years and months", () => {
    expect(formatCandidateExperience(6.17)).toBe("6 years 2 months");
    expect(formatCandidateExperience(9.42)).toBe("9 years 5 months");
  });

  it("labels zero experience as Fresher", () => {
    expect(formatCandidateExperience(0)).toBe("Fresher");
  });
});

describe("formatCompactCandidateExperience", () => {
  it("formats stored experience as compact decimal years", () => {
    expect(formatCompactCandidateExperience(6.5)).toBe("6.5 years");
    expect(formatCompactCandidateExperience(9.17)).toBe("9.2 years");
  });

  it("labels zero experience as Fresher", () => {
    expect(formatCompactCandidateExperience(0)).toBe("Fresher");
  });
});
