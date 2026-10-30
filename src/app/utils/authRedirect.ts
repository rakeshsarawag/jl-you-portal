export function getPasswordResetRedirectUrl(origin = window.location.origin) {
  return `${origin}/reset-password?mode=recovery`;
}

export function isPasswordRecoveryUrl(
  location: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location,
) {
  const search = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));

  return location.pathname === '/reset-password'
    || search.get('mode') === 'recovery'
    || search.get('type') === 'recovery'
    || hash.get('type') === 'recovery';
}

export function getRecoverySessionFromHash(hash = window.location.hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('type') !== 'recovery') return null;

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  return accessToken && refreshToken
    ? { access_token: accessToken, refresh_token: refreshToken }
    : null;
}
