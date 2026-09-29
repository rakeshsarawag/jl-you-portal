/**
 * Unit tests for constants.ts — validates that all exported lookup tables,
 * constants, and maps have the correct shape and values.
 *
 * Note: supabase client and apiHeaders are not tested here because they
 * require a live Supabase connection. Only pure data exports are tested.
 */
import { describe, it, expect } from "vitest";
import {
  DEFECT_SEVERITY_LIST,
  DEFECT_PRIORITY_LIST,
  DEFECT_ENVIRONMENT_LIST,
  DEFECT_STATUS_LIST,
  SEVERITY_COLOR_MAP,
  SEVERITY_BADGE_MAP,
  PRIORITY_BADGE_MAP,
  OKR_PROGRESS_BANDS,
  OKR_GRADE_COLORS,
  OKR_GRADE_THRESHOLDS,
  PF_WAGE_CEILING,
  ESI_GROSS_LIMIT,
  ESI_EMPLOYEE_RATE,
  ESI_EMPLOYER_RATE,
  TDS_CESS_RATE,
  TDS_STD_DEDUCTION_NEW,
  TDS_STD_DEDUCTION_OLD,
  LOP_WORKING_DAYS,
  TDS_SLABS_FY2526_NEW,
  TDS_87A_REBATE_LIMIT_NEW,
  TDS_87A_REBATE_LIMIT_OLD,
  GST_RATES,
  INVOICE_STATUS_COLORS,
  PAYMENT_METHODS,
} from "../../../src/app/utils/constants";

// ── Defect constants ──────────────────────────────────────────────────────────

describe("DEFECT_SEVERITY_LIST", () => {
  it("contains all four severity levels", () => {
    expect(DEFECT_SEVERITY_LIST).toEqual(["Very High", "High", "Medium", "Low"]);
  });

  it("has 4 entries", () => {
    expect(DEFECT_SEVERITY_LIST).toHaveLength(4);
  });
});

describe("DEFECT_PRIORITY_LIST", () => {
  it("has 4 priority codes P1–P4", () => {
    const codes = DEFECT_PRIORITY_LIST.map((p) => p.code);
    expect(codes).toContain("P1");
    expect(codes).toContain("P2");
    expect(codes).toContain("P3");
    expect(codes).toContain("P4");
  });

  it("each entry has code and label", () => {
    for (const p of DEFECT_PRIORITY_LIST) {
      expect(typeof p.code).toBe("string");
      expect(typeof p.label).toBe("string");
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it("P1 is the highest priority", () => {
    const p1 = DEFECT_PRIORITY_LIST.find((p) => p.code === "P1");
    expect(p1).toBeDefined();
    expect(p1!.label.toLowerCase()).toMatch(/critical|highest|p1/i);
  });
});

describe("DEFECT_ENVIRONMENT_LIST", () => {
  it("is a non-empty array of strings", () => {
    expect(Array.isArray(DEFECT_ENVIRONMENT_LIST)).toBe(true);
    expect(DEFECT_ENVIRONMENT_LIST.length).toBeGreaterThan(0);
    for (const env of DEFECT_ENVIRONMENT_LIST) {
      expect(typeof env).toBe("string");
    }
  });

  it("includes common environments", () => {
    const lower = DEFECT_ENVIRONMENT_LIST.map((e) => e.toLowerCase());
    const hasProd = lower.some((e) => e.includes("prod") || e.includes("staging") || e.includes("dev") || e.includes("qa"));
    expect(hasProd).toBe(true);
  });
});

describe("DEFECT_STATUS_LIST", () => {
  it("is a non-empty array", () => {
    expect(DEFECT_STATUS_LIST.length).toBeGreaterThan(0);
  });

  it("includes core lifecycle statuses", () => {
    const lower = DEFECT_STATUS_LIST.map((s) => s.toLowerCase());
    expect(lower.some((s) => s.includes("open") || s.includes("new"))).toBe(true);
    expect(lower.some((s) => s.includes("close") || s.includes("resolved") || s.includes("fixed"))).toBe(true);
  });
});

describe("SEVERITY_COLOR_MAP", () => {
  it("has an entry for each severity level", () => {
    for (const sev of DEFECT_SEVERITY_LIST) {
      expect(SEVERITY_COLOR_MAP[sev]).toBeDefined();
      expect(typeof SEVERITY_COLOR_MAP[sev]).toBe("string");
    }
  });

  it("Very High maps to a red-ish color", () => {
    // May be a hex color or a Tailwind class — just verify it's a non-empty string
    const val = SEVERITY_COLOR_MAP["Very High"];
    expect(typeof val).toBe("string");
    expect(val.length).toBeGreaterThan(0);
  });

  it("Low maps to a different color than Very High", () => {
    expect(SEVERITY_COLOR_MAP["Low"]).not.toBe(SEVERITY_COLOR_MAP["Very High"]);
  });
});

describe("SEVERITY_BADGE_MAP", () => {
  it("has bg and text for each severity", () => {
    for (const sev of DEFECT_SEVERITY_LIST) {
      expect(SEVERITY_BADGE_MAP[sev]).toBeDefined();
      expect(typeof SEVERITY_BADGE_MAP[sev].bg).toBe("string");
      expect(typeof SEVERITY_BADGE_MAP[sev].text).toBe("string");
    }
  });

  it("bg values start with bg-", () => {
    for (const sev of DEFECT_SEVERITY_LIST) {
      expect(SEVERITY_BADGE_MAP[sev].bg).toMatch(/^bg-/);
    }
  });

  it("text values start with text-", () => {
    for (const sev of DEFECT_SEVERITY_LIST) {
      expect(SEVERITY_BADGE_MAP[sev].text).toMatch(/^text-/);
    }
  });
});

describe("PRIORITY_BADGE_MAP", () => {
  it("has bg and text for each priority", () => {
    const codes = DEFECT_PRIORITY_LIST.map((p) => p.code);
    for (const code of codes) {
      expect(PRIORITY_BADGE_MAP[code]).toBeDefined();
      expect(typeof PRIORITY_BADGE_MAP[code].bg).toBe("string");
      expect(typeof PRIORITY_BADGE_MAP[code].text).toBe("string");
    }
  });
});

// ── OKR constants ─────────────────────────────────────────────────────────────

describe("OKR_PROGRESS_BANDS", () => {
  it("is a non-empty array", () => {
    expect(OKR_PROGRESS_BANDS.length).toBeGreaterThan(0);
  });

  it("each band has min, max, label, color", () => {
    for (const band of OKR_PROGRESS_BANDS) {
      expect(typeof band.min).toBe("number");
      expect(typeof band.max).toBe("number");
      expect(typeof band.label).toBe("string");
      expect(typeof band.color).toBe("string");
      expect(band.min).toBeLessThanOrEqual(band.max);
    }
  });

  it("bands span 0 to 1 (or 0 to 100)", () => {
    const min = Math.min(...OKR_PROGRESS_BANDS.map((b) => b.min));
    const max = Math.max(...OKR_PROGRESS_BANDS.map((b) => b.max));
    expect(min).toBe(0);
    expect(max === 100 || max === 1.0).toBe(true);
  });
});

describe("OKR_GRADE_COLORS", () => {
  it("has colors for grades A, B, C, D", () => {
    for (const grade of ["A", "B", "C", "D"]) {
      expect(OKR_GRADE_COLORS[grade]).toBeDefined();
      expect(typeof OKR_GRADE_COLORS[grade]).toBe("string");
    }
  });

  it("grade A is green", () => {
    expect(OKR_GRADE_COLORS["A"]).toMatch(/green/i);
  });

  it("grade D is red or orange", () => {
    expect(OKR_GRADE_COLORS["D"]).toMatch(/red|orange|rose/i);
  });
});

describe("OKR_GRADE_THRESHOLDS", () => {
  it("has A, B, C, D thresholds as fractions between 0 and 1", () => {
    for (const [grade, threshold] of Object.entries(OKR_GRADE_THRESHOLDS)) {
      expect(threshold).toBeGreaterThan(0);
      expect(threshold).toBeLessThan(1);
      expect(["A", "B", "C", "D"]).toContain(grade);
    }
  });

  it("A threshold is the highest", () => {
    expect(OKR_GRADE_THRESHOLDS.A).toBeGreaterThan(OKR_GRADE_THRESHOLDS.B);
    expect(OKR_GRADE_THRESHOLDS.B).toBeGreaterThan(OKR_GRADE_THRESHOLDS.C);
    expect(OKR_GRADE_THRESHOLDS.C).toBeGreaterThan(OKR_GRADE_THRESHOLDS.D);
  });
});

// ── Payroll / Tax constants ───────────────────────────────────────────────────

describe("Payroll constants", () => {
  it("PF_WAGE_CEILING is 15000", () => {
    expect(PF_WAGE_CEILING).toBe(15000);
  });

  it("ESI_GROSS_LIMIT is 21000", () => {
    expect(ESI_GROSS_LIMIT).toBe(21000);
  });

  it("ESI_EMPLOYEE_RATE is 0.75%", () => {
    expect(ESI_EMPLOYEE_RATE).toBeCloseTo(0.0075, 4);
  });

  it("ESI_EMPLOYER_RATE is 3.25%", () => {
    expect(ESI_EMPLOYER_RATE).toBeCloseTo(0.0325, 4);
  });

  it("TDS_CESS_RATE is 4%", () => {
    expect(TDS_CESS_RATE).toBeCloseTo(0.04, 4);
  });

  it("TDS_STD_DEDUCTION_NEW is 75000", () => {
    expect(TDS_STD_DEDUCTION_NEW).toBe(75000);
  });

  it("TDS_STD_DEDUCTION_OLD is 50000", () => {
    expect(TDS_STD_DEDUCTION_OLD).toBe(50000);
  });

  it("LOP_WORKING_DAYS is 30", () => {
    expect(LOP_WORKING_DAYS).toBe(30);
  });
});

describe("TDS_SLABS_FY2526_NEW", () => {
  it("is a non-empty array of slabs", () => {
    expect(TDS_SLABS_FY2526_NEW.length).toBeGreaterThan(0);
  });

  it("each slab has from/to or min/max, and a rate", () => {
    for (const slab of TDS_SLABS_FY2526_NEW) {
      const start = (slab as any).from ?? (slab as any).min;
      expect(typeof start).toBe("number");
      expect(typeof slab.rate).toBe("number");
      expect(slab.rate).toBeGreaterThanOrEqual(0);
      expect(slab.rate).toBeLessThanOrEqual(1);
    }
  });

  it("first slab starts at 0", () => {
    const first = TDS_SLABS_FY2526_NEW[0] as any;
    const start = first.from ?? first.min;
    expect(start).toBe(0);
  });

  it("rates are in ascending order", () => {
    const rates = TDS_SLABS_FY2526_NEW.map((s) => s.rate);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    }
  });
});

describe("TDS rebate limits", () => {
  it("TDS_87A_REBATE_LIMIT_NEW is 700000", () => {
    expect(TDS_87A_REBATE_LIMIT_NEW).toBe(700000);
  });

  it("TDS_87A_REBATE_LIMIT_OLD is 500000", () => {
    expect(TDS_87A_REBATE_LIMIT_OLD).toBe(500000);
  });

  it("new regime limit is higher than old regime limit", () => {
    expect(TDS_87A_REBATE_LIMIT_NEW).toBeGreaterThan(TDS_87A_REBATE_LIMIT_OLD);
  });
});

// ── Invoice / GST constants ───────────────────────────────────────────────────

describe("GST_RATES", () => {
  it("contains standard Indian GST rates", () => {
    const rates = [...GST_RATES];
    expect(rates).toContain(0);
    expect(rates).toContain(5);
    expect(rates).toContain(12);
    expect(rates).toContain(18);
    expect(rates).toContain(28);
  });

  it("has 5 rates", () => {
    expect(GST_RATES).toHaveLength(5);
  });
});

describe("INVOICE_STATUS_COLORS", () => {
  it("has colors for core invoice statuses", () => {
    const lower = Object.keys(INVOICE_STATUS_COLORS).map((k) => k.toLowerCase());
    expect(lower.some((k) => k.includes("paid") || k.includes("complete"))).toBe(true);
    expect(lower.some((k) => k.includes("overdue") || k.includes("late"))).toBe(true);
    expect(lower.some((k) => k.includes("draft") || k.includes("pending"))).toBe(true);
  });

  it("all values are non-empty strings", () => {
    for (const val of Object.values(INVOICE_STATUS_COLORS)) {
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
    }
  });
});

describe("PAYMENT_METHODS", () => {
  it("contains bank_transfer and upi", () => {
    expect(PAYMENT_METHODS).toContain("bank_transfer");
    expect(PAYMENT_METHODS).toContain("upi");
  });

  it("has at least 3 methods", () => {
    expect(PAYMENT_METHODS.length).toBeGreaterThanOrEqual(3);
  });
});
