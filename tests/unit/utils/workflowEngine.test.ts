import { describe, it, expect } from "vitest";

// Workflow state machine logic tested standalone

type WFStatus = "Pending" | "In-Review" | "Escalated" | "Approved" | "Rejected" | "Cancelled";

interface WorkflowInstance {
  id: string;
  status: WFStatus;
  current_step: number;
  total_steps: number;
  escalation_count: number;
  created_at: string;
  updated_at: string;
}

const VALID_TRANSITIONS: Record<WFStatus, WFStatus[]> = {
  "Pending":    ["In-Review", "Cancelled"],
  "In-Review":  ["Approved", "Rejected", "Escalated", "Cancelled"],
  "Escalated":  ["In-Review", "Approved", "Rejected", "Cancelled"],
  "Approved":   [],
  "Rejected":   [],
  "Cancelled":  [],
};

function canTransition(from: WFStatus, to: WFStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function transition(instance: WorkflowInstance, to: WFStatus): WorkflowInstance {
  if (!canTransition(instance.status, to)) {
    throw new Error(`Invalid transition: ${instance.status} → ${to}`);
  }
  return {
    ...instance,
    status: to,
    escalation_count: to === "Escalated" ? instance.escalation_count + 1 : instance.escalation_count,
    updated_at: new Date().toISOString(),
  };
}

function isTerminal(status: WFStatus): boolean {
  return ["Approved", "Rejected", "Cancelled"].includes(status);
}

function progressPercent(instance: WorkflowInstance): number {
  if (instance.total_steps === 0) return 0;
  return Math.round((instance.current_step / instance.total_steps) * 100);
}

function buildInstance(overrides: Partial<WorkflowInstance> = {}): WorkflowInstance {
  return {
    id: "wf-001",
    status: "Pending",
    current_step: 0,
    total_steps: 3,
    escalation_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("canTransition", () => {
  it("allows Pending → In-Review", () => {
    expect(canTransition("Pending", "In-Review")).toBe(true);
  });

  it("allows Pending → Cancelled", () => {
    expect(canTransition("Pending", "Cancelled")).toBe(true);
  });

  it("blocks Pending → Approved (must go via In-Review)", () => {
    expect(canTransition("Pending", "Approved")).toBe(false);
  });

  it("blocks Approved → Rejected (terminal state)", () => {
    expect(canTransition("Approved", "Rejected")).toBe(false);
  });

  it("allows Escalated → Approved", () => {
    expect(canTransition("Escalated", "Approved")).toBe(true);
  });

  it("allows In-Review → Escalated", () => {
    expect(canTransition("In-Review", "Escalated")).toBe(true);
  });
});

describe("transition()", () => {
  it("changes status on valid transition", () => {
    const wf = buildInstance();
    const next = transition(wf, "In-Review");
    expect(next.status).toBe("In-Review");
  });

  it("increments escalation_count on Escalated transition", () => {
    const wf = buildInstance({ status: "In-Review" });
    const next = transition(wf, "Escalated");
    expect(next.escalation_count).toBe(1);
  });

  it("does not increment escalation_count on other transitions", () => {
    const wf = buildInstance();
    const next = transition(wf, "In-Review");
    expect(next.escalation_count).toBe(0);
  });

  it("throws on invalid transition", () => {
    const wf = buildInstance({ status: "Approved" });
    expect(() => transition(wf, "Rejected")).toThrow("Invalid transition");
  });

  it("preserves other fields on transition", () => {
    const wf = buildInstance({ total_steps: 5, current_step: 2 });
    const next = transition(wf, "In-Review");
    expect(next.total_steps).toBe(5);
    expect(next.current_step).toBe(2);
  });
});

describe("isTerminal()", () => {
  it("returns true for Approved", () => expect(isTerminal("Approved")).toBe(true));
  it("returns true for Rejected", () => expect(isTerminal("Rejected")).toBe(true));
  it("returns true for Cancelled", () => expect(isTerminal("Cancelled")).toBe(true));
  it("returns false for Pending", () => expect(isTerminal("Pending")).toBe(false));
  it("returns false for In-Review", () => expect(isTerminal("In-Review")).toBe(false));
  it("returns false for Escalated", () => expect(isTerminal("Escalated")).toBe(false));
});

describe("progressPercent()", () => {
  it("returns 0 when no steps completed", () => {
    expect(progressPercent(buildInstance({ current_step: 0, total_steps: 3 }))).toBe(0);
  });

  it("returns 100 when all steps completed", () => {
    expect(progressPercent(buildInstance({ current_step: 3, total_steps: 3 }))).toBe(100);
  });

  it("returns 33 at 1/3", () => {
    expect(progressPercent(buildInstance({ current_step: 1, total_steps: 3 }))).toBe(33);
  });

  it("returns 0 for zero total_steps", () => {
    expect(progressPercent(buildInstance({ current_step: 0, total_steps: 0 }))).toBe(0);
  });
});
