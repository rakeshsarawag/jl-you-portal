import { describe, it, expect } from "vitest";

interface EmployeeProfile {
  phone?: string;
  address?: string;
  emergency_contact_name?: string;
  bank_account_number?: string;
  pan_number?: string;
  avatar_url?: string;
  department_id?: string;
  designation_id?: string;
}

function calculateProfileCompleteness(profile: EmployeeProfile): number {
  const fields: (keyof EmployeeProfile)[] = [
    "phone", "address", "emergency_contact_name",
    "bank_account_number", "pan_number", "avatar_url",
    "department_id", "designation_id",
  ];
  const filled = fields.filter(f => !!profile[f]).length;
  return Math.round((filled / fields.length) * 100);
}

function profileCompletenessLabel(score: number): "complete" | "good" | "partial" | "incomplete" {
  if (score >= 100) return "complete";
  if (score >= 80) return "good";
  if (score >= 50) return "partial";
  return "incomplete";
}

function missingProfileFields(profile: EmployeeProfile): string[] {
  const fieldLabels: Record<keyof EmployeeProfile, string> = {
    phone: "Phone number",
    address: "Address",
    emergency_contact_name: "Emergency contact",
    bank_account_number: "Bank account",
    pan_number: "PAN number",
    avatar_url: "Profile photo",
    department_id: "Department",
    designation_id: "Designation",
  };
  return (Object.keys(fieldLabels) as (keyof EmployeeProfile)[])
    .filter(f => !profile[f])
    .map(f => fieldLabels[f]);
}

describe("calculateProfileCompleteness", () => {
  it("empty profile returns 0", () => {
    expect(calculateProfileCompleteness({})).toBe(0);
  });

  it("fully filled profile returns 100", () => {
    const full: EmployeeProfile = {
      phone: "9876543210",
      address: "123 Street",
      emergency_contact_name: "Jane",
      bank_account_number: "123456789",
      pan_number: "ABCDE1234F",
      avatar_url: "https://cdn.example.com/avatar.jpg",
      department_id: "dept-1",
      designation_id: "desg-1",
    };
    expect(calculateProfileCompleteness(full)).toBe(100);
  });

  it("4 of 8 fields gives 50", () => {
    const partial: EmployeeProfile = {
      phone: "9876543210",
      address: "123 Street",
      department_id: "dept-1",
      designation_id: "desg-1",
    };
    expect(calculateProfileCompleteness(partial)).toBe(50);
  });

  it("empty string fields count as missing", () => {
    expect(calculateProfileCompleteness({ phone: "", address: "123 St" })).toBe(13);
  });
});

describe("profileCompletenessLabel", () => {
  it("100 → complete", () => expect(profileCompletenessLabel(100)).toBe("complete"));
  it("80 → good", () => expect(profileCompletenessLabel(80)).toBe("good"));
  it("85 → good", () => expect(profileCompletenessLabel(85)).toBe("good"));
  it("50 → partial", () => expect(profileCompletenessLabel(50)).toBe("partial"));
  it("25 → incomplete", () => expect(profileCompletenessLabel(25)).toBe("incomplete"));
  it("0 → incomplete", () => expect(profileCompletenessLabel(0)).toBe("incomplete"));
});

describe("missingProfileFields", () => {
  it("all missing on empty profile", () => {
    const missing = missingProfileFields({});
    expect(missing).toHaveLength(8);
    expect(missing).toContain("Phone number");
    expect(missing).toContain("PAN number");
  });

  it("returns only missing fields", () => {
    const missing = missingProfileFields({ phone: "123", address: "St" });
    expect(missing).not.toContain("Phone number");
    expect(missing).not.toContain("Address");
    expect(missing).toHaveLength(6);
  });

  it("nothing missing for complete profile", () => {
    const full: EmployeeProfile = {
      phone: "9876543210", address: "123 Street", emergency_contact_name: "Jane",
      bank_account_number: "123456789", pan_number: "ABCDE1234F",
      avatar_url: "https://cdn.example.com/avatar.jpg", department_id: "d1", designation_id: "d2",
    };
    expect(missingProfileFields(full)).toHaveLength(0);
  });
});
