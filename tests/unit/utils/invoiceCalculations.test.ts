import { describe, it, expect } from "vitest";

// Pure invoice calculation logic tested in isolation

function calcSubtotal(items: { quantity: number; rate: number }[]): number {
  return items.reduce((s, i) => s + i.quantity * i.rate, 0);
}

function calcTax(subtotal: number, ratePercent: number): number {
  return Math.round((subtotal * ratePercent / 100) * 100) / 100;
}

function calcDiscount(subtotal: number, discountPercent: number): number {
  return Math.round((subtotal * discountPercent / 100) * 100) / 100;
}

function calcTotal(subtotal: number, taxAmount: number, discountAmount = 0): number {
  return Math.round((subtotal + taxAmount - discountAmount) * 100) / 100;
}

function formatInvoiceNumber(seq: number): string {
  return `JL-INV-${String(seq).padStart(4, "0")}`;
}

function isOverdue(dueDateStr: string, today = new Date()): boolean {
  const due = new Date(dueDateStr);
  due.setHours(23, 59, 59, 999);
  return today > due;
}

function daysOverdue(dueDateStr: string, today = new Date()): number {
  const due = new Date(dueDateStr);
  const diff = today.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function nextReminderDate(invoiceDateStr: string, termsDays: number): string {
  const d = new Date(invoiceDateStr);
  d.setDate(d.getDate() + termsDays);
  return d.toISOString().slice(0, 10);
}

describe("calcSubtotal", () => {
  it("sums quantity × rate for all line items", () => {
    expect(calcSubtotal([{ quantity: 2, rate: 500 }, { quantity: 3, rate: 200 }])).toBe(1600);
  });

  it("returns 0 for empty items", () => {
    expect(calcSubtotal([])).toBe(0);
  });

  it("handles fractional rates", () => {
    expect(calcSubtotal([{ quantity: 1, rate: 99.99 }])).toBeCloseTo(99.99);
  });

  it("handles single item", () => {
    expect(calcSubtotal([{ quantity: 10, rate: 1000 }])).toBe(10000);
  });
});

describe("calcTax (GST)", () => {
  it("calculates 18% GST correctly", () => {
    expect(calcTax(10000, 18)).toBe(1800);
  });

  it("calculates 12% GST correctly", () => {
    expect(calcTax(5000, 12)).toBe(600);
  });

  it("returns 0 for 0% rate", () => {
    expect(calcTax(10000, 0)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(calcTax(1000, 18.5)).toBe(185);
  });
});

describe("calcDiscount", () => {
  it("applies 10% discount correctly", () => {
    expect(calcDiscount(10000, 10)).toBe(1000);
  });

  it("returns 0 for 0% discount", () => {
    expect(calcDiscount(10000, 0)).toBe(0);
  });

  it("returns full amount for 100% discount", () => {
    expect(calcDiscount(5000, 100)).toBe(5000);
  });
});

describe("calcTotal", () => {
  it("adds subtotal + tax", () => {
    expect(calcTotal(10000, 1800)).toBe(11800);
  });

  it("subtracts discount", () => {
    expect(calcTotal(10000, 1800, 500)).toBe(11300);
  });

  it("handles zero tax and discount", () => {
    expect(calcTotal(5000, 0, 0)).toBe(5000);
  });
});

describe("formatInvoiceNumber", () => {
  it("pads with leading zeros to 4 digits", () => {
    expect(formatInvoiceNumber(1)).toBe("JL-INV-0001");
    expect(formatInvoiceNumber(42)).toBe("JL-INV-0042");
    expect(formatInvoiceNumber(1000)).toBe("JL-INV-1000");
  });

  it("handles 5-digit sequences without truncation", () => {
    expect(formatInvoiceNumber(10001)).toBe("JL-INV-10001");
  });
});

describe("isOverdue", () => {
  it("returns true when due date is in the past", () => {
    expect(isOverdue("2020-01-01", new Date("2025-01-01"))).toBe(true);
  });

  it("returns false when due date is in the future", () => {
    expect(isOverdue("2099-12-31", new Date("2026-01-01"))).toBe(false);
  });

  it("returns false on the due date itself", () => {
    expect(isOverdue("2026-09-21", new Date("2026-09-21T12:00:00"))).toBe(false);
  });
});

describe("daysOverdue", () => {
  it("returns 0 when not overdue", () => {
    expect(daysOverdue("2099-01-01", new Date("2026-01-01"))).toBe(0);
  });

  it("returns correct number of days overdue", () => {
    expect(daysOverdue("2026-09-01", new Date("2026-09-11"))).toBe(10);
  });
});

describe("nextReminderDate", () => {
  it("adds payment terms days to invoice date", () => {
    expect(nextReminderDate("2026-09-01", 30)).toBe("2026-10-01");
  });

  it("handles month boundary", () => {
    expect(nextReminderDate("2026-01-31", 1)).toBe("2026-02-01");
  });
});
