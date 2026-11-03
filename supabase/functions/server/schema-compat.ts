type SupabaseWriteResult = {
  error?: unknown;
};

const LEGACY_CONSTRAINT_COLUMNS: Record<string, string> = {
  employees_status_check: 'status',
  onboarding_records_status_check: 'status',
  recruitment_candidates_source_check: 'source',
  recruitment_feedback_recommendation_check: 'recommendation',
  recruitment_interviews_status_check: 'status',
  recruitment_jobs_type_check: 'type',
};

export function getMissingSchemaColumn(error: unknown): string | null {
  const code = (error as { code?: string })?.code;
  const message = String((error as { message?: string })?.message ?? '');
  if (code !== 'PGRST204' && code !== '42703' && !message.includes('schema cache')) {
    return null;
  }

  return message.match(/Could not find the '([^']+)' column/i)?.[1]
    ?? message.match(/column [^.]+\.(\w+) does not exist/i)?.[1]
    ?? null;
}

export function getLegacyConstraintColumn(error: unknown): string | null {
  if ((error as { code?: string })?.code !== '23514') return null;
  const message = String((error as { message?: string })?.message ?? '');
  const constraint = message.match(/violates check constraint "([^"]+)"/i)?.[1];
  return constraint ? LEGACY_CONSTRAINT_COLUMNS[constraint] ?? null : null;
}

export async function writeWithSchemaCompatibility<T extends SupabaseWriteResult>(
  record: Record<string, any>,
  write: (compatibleRecord: Record<string, any>) => PromiseLike<T>,
): Promise<T> {
  const compatibleRecord = { ...record };

  while (true) {
    const result = await write(compatibleRecord);
    const incompatibleColumn = getMissingSchemaColumn(result.error)
      ?? getLegacyConstraintColumn(result.error);
    if (!incompatibleColumn || !(incompatibleColumn in compatibleRecord)) {
      return result;
    }
    delete compatibleRecord[incompatibleColumn];
  }
}
