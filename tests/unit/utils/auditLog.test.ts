import { describe, it, expect } from 'vitest';

// Audit log helpers — logic mirrored from audit-helpers.ts for unit testing

type AuditAction = 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'assign' | 'export';

interface AuditEntry {
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  actor: string;
  module?: string;
  changed_fields?: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

function buildAuditEntry(
  partial: Omit<AuditEntry, 'created_at' | 'module'> & { module?: string },
  now = new Date()
): AuditEntry {
  return {
    ...partial,
    module: partial.module ?? partial.entity_type,
    created_at: now.toISOString(),
  };
}

function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { before: unknown; after: unknown }> {
  const changed: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed[key] = { before: before[key], after: after[key] };
    }
  }
  return changed;
}

function hasAuditableChange(diff: Record<string, { before: unknown; after: unknown }>): boolean {
  return Object.keys(diff).length > 0;
}

function maskSensitiveFields(
  diff: Record<string, { before: unknown; after: unknown }>,
  sensitiveKeys: string[]
): Record<string, { before: unknown; after: unknown }> {
  const result: Record<string, { before: unknown; after: unknown }> = {};
  for (const [key, val] of Object.entries(diff)) {
    if (sensitiveKeys.includes(key)) {
      result[key] = { before: '***', after: '***' };
    } else {
      result[key] = val;
    }
  }
  return result;
}

function isValidAuditAction(action: string): action is AuditAction {
  return ['create', 'update', 'delete', 'approve', 'reject', 'assign', 'export'].includes(action);
}

describe('buildAuditEntry', () => {
  it('fills created_at', () => {
    const entry = buildAuditEntry({ entity_type: 'employee', entity_id: 'e1', action: 'create', actor: 'admin@test.com' });
    expect(entry.created_at).toBeTruthy();
    expect(new Date(entry.created_at).getFullYear()).toBeGreaterThan(2020);
  });

  it('defaults module to entity_type', () => {
    const entry = buildAuditEntry({ entity_type: 'payroll', entity_id: 'p1', action: 'update', actor: 'hr@test.com' });
    expect(entry.module).toBe('payroll');
  });

  it('respects explicit module', () => {
    const entry = buildAuditEntry({ entity_type: 'leave', entity_id: 'l1', action: 'approve', actor: 'mgr@test.com', module: 'hrms' });
    expect(entry.module).toBe('hrms');
  });

  it('preserves changed_fields', () => {
    const changed = { status: { before: 'pending', after: 'approved' } };
    const entry = buildAuditEntry({ entity_type: 'leave', entity_id: 'l1', action: 'approve', actor: 'mgr@test.com', changed_fields: changed });
    expect(entry.changed_fields).toEqual(changed);
  });
});

describe('diffObjects', () => {
  it('detects scalar changes', () => {
    const diff = diffObjects({ name: 'Alice' }, { name: 'Bob' });
    expect(diff).toHaveProperty('name');
    expect(diff.name.before).toBe('Alice');
    expect(diff.name.after).toBe('Bob');
  });

  it('returns empty for identical objects', () => {
    expect(diffObjects({ x: 1 }, { x: 1 })).toEqual({});
  });

  it('detects added keys', () => {
    const diff = diffObjects({}, { newKey: 42 });
    expect(diff).toHaveProperty('newKey');
    expect(diff.newKey.before).toBeUndefined();
  });

  it('detects removed keys', () => {
    const diff = diffObjects({ oldKey: 'val' }, {});
    expect(diff).toHaveProperty('oldKey');
    expect(diff.oldKey.after).toBeUndefined();
  });

  it('compares nested objects by JSON equality', () => {
    const diff = diffObjects({ meta: { a: 1 } }, { meta: { a: 2 } });
    expect(diff).toHaveProperty('meta');
  });

  it('no diff for equal nested objects', () => {
    const diff = diffObjects({ meta: { a: 1 } }, { meta: { a: 1 } });
    expect(diff).toEqual({});
  });
});

describe('hasAuditableChange', () => {
  it('true when diff is non-empty', () => {
    expect(hasAuditableChange({ name: { before: 'a', after: 'b' } })).toBe(true);
  });

  it('false when diff is empty', () => {
    expect(hasAuditableChange({})).toBe(false);
  });
});

describe('maskSensitiveFields', () => {
  it('masks specified keys', () => {
    const diff = { salary: { before: 50000, after: 60000 }, name: { before: 'Alice', after: 'Bob' } };
    const masked = maskSensitiveFields(diff, ['salary']);
    expect(masked.salary.before).toBe('***');
    expect(masked.salary.after).toBe('***');
    expect(masked.name.before).toBe('Alice');
  });

  it('does not mask unspecified keys', () => {
    const diff = { x: { before: 1, after: 2 } };
    const masked = maskSensitiveFields(diff, ['password']);
    expect(masked.x.before).toBe(1);
  });

  it('handles empty diff', () => {
    expect(maskSensitiveFields({}, ['salary'])).toEqual({});
  });
});

describe('isValidAuditAction', () => {
  it('accepts valid actions', () => {
    for (const a of ['create', 'update', 'delete', 'approve', 'reject', 'assign', 'export']) {
      expect(isValidAuditAction(a)).toBe(true);
    }
  });

  it('rejects invalid strings', () => {
    expect(isValidAuditAction('view')).toBe(false);
    expect(isValidAuditAction('')).toBe(false);
    expect(isValidAuditAction('CREATE')).toBe(false);
  });
});
