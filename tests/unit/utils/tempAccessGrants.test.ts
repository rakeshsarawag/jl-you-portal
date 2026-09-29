import { describe, it, expect } from 'vitest';

// Temporary access grant helpers — unit tests for grant state logic

type GrantStatus = 'active' | 'expired' | 'revoked';

function getGrantStatus(grant: { is_revoked: boolean; expires_at: string }, now = new Date()): GrantStatus {
  if (grant.is_revoked) return 'revoked';
  if (new Date(grant.expires_at) <= now) return 'expired';
  return 'active';
}

function filterActiveGrants(grants: { id: string; is_revoked: boolean; expires_at: string }[], now = new Date()) {
  return grants.filter(g => getGrantStatus(g, now) === 'active');
}

function isGrantValidForApp(
  grants: { app_id: string; section_id?: string; is_revoked: boolean; expires_at: string }[],
  appId: string,
  sectionId?: string,
  now = new Date()
): boolean {
  return grants.some(g => {
    if (getGrantStatus(g, now) !== 'active') return false;
    if (g.app_id !== appId) return false;
    if (sectionId && g.section_id && g.section_id !== sectionId) return false;
    return true;
  });
}

function sortGrantsByExpiry(grants: { id: string; expires_at: string }[]): typeof grants {
  return [...grants].sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());
}

function grantExpiresInHours(grant: { expires_at: string }, now = new Date()): number {
  return (new Date(grant.expires_at).getTime() - now.getTime()) / 3_600_000;
}

function isGrantExpiringSoon(grant: { expires_at: string }, thresholdHours = 24, now = new Date()): boolean {
  const hoursLeft = grantExpiresInHours(grant, now);
  return hoursLeft > 0 && hoursLeft <= thresholdHours;
}

const FUTURE = new Date(Date.now() + 86_400_000 * 7).toISOString(); // 7 days ahead
const PAST   = new Date(Date.now() - 86_400_000).toISOString();     // 1 day ago
const SOON   = new Date(Date.now() + 3_600_000).toISOString();      // 1 hour ahead

describe('getGrantStatus', () => {
  it('returns active for non-revoked future grant', () => {
    expect(getGrantStatus({ is_revoked: false, expires_at: FUTURE })).toBe('active');
  });

  it('returns expired for past expiry', () => {
    expect(getGrantStatus({ is_revoked: false, expires_at: PAST })).toBe('expired');
  });

  it('returns revoked regardless of expiry', () => {
    expect(getGrantStatus({ is_revoked: true, expires_at: FUTURE })).toBe('revoked');
    expect(getGrantStatus({ is_revoked: true, expires_at: PAST })).toBe('revoked');
  });
});

describe('filterActiveGrants', () => {
  const grants = [
    { id: '1', is_revoked: false, expires_at: FUTURE },
    { id: '2', is_revoked: true,  expires_at: FUTURE },
    { id: '3', is_revoked: false, expires_at: PAST   },
    { id: '4', is_revoked: false, expires_at: FUTURE },
  ];

  it('returns only active grants', () => {
    const active = filterActiveGrants(grants);
    expect(active.map(g => g.id)).toEqual(['1', '4']);
  });

  it('returns empty when all expired or revoked', () => {
    const all = [
      { id: '1', is_revoked: true,  expires_at: FUTURE },
      { id: '2', is_revoked: false, expires_at: PAST   },
    ];
    expect(filterActiveGrants(all)).toHaveLength(0);
  });
});

describe('isGrantValidForApp', () => {
  const grants = [
    { app_id: 'payroll', section_id: 'slips',  is_revoked: false, expires_at: FUTURE },
    { app_id: 'hrms',    section_id: undefined, is_revoked: false, expires_at: FUTURE },
    { app_id: 'payroll', section_id: 'slips',  is_revoked: true,  expires_at: FUTURE },
  ];

  it('returns true when matching active grant exists', () => {
    expect(isGrantValidForApp(grants, 'payroll')).toBe(true);
    expect(isGrantValidForApp(grants, 'hrms')).toBe(true);
  });

  it('returns false for app with no grant', () => {
    expect(isGrantValidForApp(grants, 'recruitment')).toBe(false);
  });

  it('respects section filter', () => {
    expect(isGrantValidForApp(grants, 'payroll', 'slips')).toBe(true);
    expect(isGrantValidForApp(grants, 'payroll', 'settings')).toBe(false);
  });

  it('ignores revoked grants', () => {
    const revokedOnly = [{ app_id: 'payroll', section_id: 'slips', is_revoked: true, expires_at: FUTURE }];
    expect(isGrantValidForApp(revokedOnly, 'payroll')).toBe(false);
  });
});

describe('sortGrantsByExpiry', () => {
  it('sorts ascending by expires_at', () => {
    const grants = [
      { id: 'c', expires_at: FUTURE },
      { id: 'a', expires_at: PAST   },
      { id: 'b', expires_at: SOON   },
    ];
    const sorted = sortGrantsByExpiry(grants);
    expect(sorted.map(g => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate original', () => {
    const grants = [{ id: 'b', expires_at: FUTURE }, { id: 'a', expires_at: PAST }];
    sortGrantsByExpiry(grants);
    expect(grants[0].id).toBe('b');
  });
});

describe('isGrantExpiringSoon', () => {
  it('returns true when within threshold', () => {
    expect(isGrantExpiringSoon({ expires_at: SOON }, 24)).toBe(true);
  });

  it('returns false when well into the future', () => {
    expect(isGrantExpiringSoon({ expires_at: FUTURE }, 24)).toBe(false);
  });

  it('returns false for already expired', () => {
    expect(isGrantExpiringSoon({ expires_at: PAST }, 24)).toBe(false);
  });

  it('respects custom threshold', () => {
    const in3Hours = new Date(Date.now() + 3 * 3_600_000).toISOString();
    expect(isGrantExpiringSoon({ expires_at: in3Hours }, 2)).toBe(false);
    expect(isGrantExpiringSoon({ expires_at: in3Hours }, 4)).toBe(true);
  });
});
