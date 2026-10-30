import { describe, expect, it } from 'vitest';
import {
  getPasswordResetRedirectUrl,
  getRecoverySessionFromHash,
  isPasswordRecoveryUrl,
} from '../../../src/app/utils/authRedirect';

describe('auth redirect helpers', () => {
  it('builds an explicit recovery callback URL', () => {
    expect(getPasswordResetRedirectUrl('https://portal.example.com'))
      .toBe('https://portal.example.com/reset-password?mode=recovery');
  });

  it('recognizes recovery callbacks by path, query, or hash', () => {
    expect(isPasswordRecoveryUrl({ pathname: '/reset-password', search: '', hash: '' })).toBe(true);
    expect(isPasswordRecoveryUrl({ pathname: '/', search: '?mode=recovery', hash: '' })).toBe(true);
    expect(isPasswordRecoveryUrl({ pathname: '/', search: '', hash: '#type=recovery' })).toBe(true);
    expect(isPasswordRecoveryUrl({ pathname: '/', search: '', hash: '#type=magiclink' })).toBe(false);
  });

  it('extracts a recovery session from an implicit callback hash', () => {
    expect(getRecoverySessionFromHash('#access_token=access&refresh_token=refresh&type=recovery'))
      .toEqual({ access_token: 'access', refresh_token: 'refresh' });
    expect(getRecoverySessionFromHash('#type=magiclink&access_token=access&refresh_token=refresh'))
      .toBeNull();
  });
});
