import { describe, expect, it, vi } from "vitest";
import {
  getLegacyConstraintColumn,
  getMissingSchemaColumn,
  writeWithSchemaCompatibility,
} from "../../../supabase/functions/server/schema-compat";

describe("schema compatibility writes", () => {
  it("recognizes PostgREST schema-cache and PostgreSQL missing-column errors", () => {
    expect(getMissingSchemaColumn({
      code: "PGRST204",
      message: "Could not find the 'lifecycle_status' column of 'employees' in the schema cache",
    })).toBe("lifecycle_status");

    expect(getMissingSchemaColumn({
      code: "42703",
      message: "column onboarding_records.work_mode does not exist",
    })).toBe("work_mode");

    expect(getMissingSchemaColumn({
      code: "23514",
      message: "new row violates check constraint",
    })).toBeNull();

    expect(getLegacyConstraintColumn({
      code: "23514",
      message: 'new row for relation "recruitment_jobs" violates check constraint "recruitment_jobs_type_check"',
    })).toBe("type");
  });

  it("retries after removing each unavailable column without mutating the original record", async () => {
    const record = {
      name: "Candidate",
      agency_name: "Agency",
      agency_fee: 1000,
    };
    const write = vi.fn(async (candidate: Record<string, unknown>) => {
      if ("agency_name" in candidate) {
        return {
          data: null,
          error: {
            code: "PGRST204",
            message: "Could not find the 'agency_name' column of 'recruitment_candidates' in the schema cache",
          },
        };
      }
      if ("agency_fee" in candidate) {
        return {
          data: null,
          error: {
            code: "42703",
            message: "column recruitment_candidates.agency_fee does not exist",
          },
        };
      }
      return { data: candidate, error: null };
    });

    const result = await writeWithSchemaCompatibility(record, write);

    expect(result).toEqual({ data: { name: "Candidate" }, error: null });
    expect(write).toHaveBeenCalledTimes(3);
    expect(record).toEqual({
      name: "Candidate",
      agency_name: "Agency",
      agency_fee: 1000,
    });
  });

  it("retries without a value rejected by a legacy check constraint", async () => {
    const write = vi.fn(async (job: Record<string, unknown>) => (
      "type" in job
        ? {
            data: null,
            error: {
              code: "23514",
              message: 'new row for relation "recruitment_jobs" violates check constraint "recruitment_jobs_type_check"',
            },
          }
        : { data: job, error: null }
    ));

    const result = await writeWithSchemaCompatibility(
      { title: "Designer", type: "Freelance" },
      write,
    );

    expect(result).toEqual({ data: { title: "Designer" }, error: null });
    expect(write).toHaveBeenCalledTimes(2);
  });
});
