/**
 * Portal Jeshan Labs - Main Application Component
 * 
 * This is a comprehensive internal employee portal with 26 integrated applications
 * Features: Authentication, Role-based access, Supabase integration, PWA support
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from './components/ui/sonner';
import KeyboardShortcutsModal from './components/ui/KeyboardShortcutsModal';
import { LoginPage } from './components/LoginPage';
import { UserProvider } from './context/UserContext';
import { DisplaySettingsProvider } from './context/DisplaySettingsContext';
import { useLocale } from '../i18n/LocaleContext';
import { PWAService } from './services/pwaService';
import { PWAStatus } from './components/mobile/PWAStatus';
import {
  supabase,
  MASTER_DATA_SEED_RECORDS,
  setApiSessionToken,
  verifyBackendSession,
} from './utils/constants';
import { createAppRouter } from './routes';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { SessionTimeoutWarning } from './components/SessionTimeoutWarning';
import { invalidatePermissionsCache } from './hooks/usePermissions';
import PreboardingPortal from './components/apps/PreboardingPortal';
import {
  getRecoverySessionFromHash,
  isPasswordRecoveryUrl,
} from './utils/authRedirect';

/**
 * Main App Component
 * Handles authentication state and routing
 */
export default function App() {
  // Subscribe to locale changes — re-renders App (and the full tree) on language switch
  useLocale();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutReason, setLogoutReason] = useState<'idle_timeout' | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(() => isPasswordRecoveryUrl());

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const recoveryRequested = isPasswordRecoveryUrl();
        let { data: { session }, error } = await supabase.auth.getSession();

        // detectSessionInUrl normally handles both callback formats. These
        // fallbacks cover slow initialization and recovery events emitted
        // before React subscribes to onAuthStateChange.
        if (recoveryRequested && !session) {
          const code = new URLSearchParams(window.location.search).get('code');
          if (code) {
            const exchange = await supabase.auth.exchangeCodeForSession(code);
            session = exchange.data.session;
            error = exchange.error;
          } else {
            const hashSession = getRecoverySessionFromHash();
            if (hashSession) {
              const restored = await supabase.auth.setSession(hashSession);
              session = restored.data.session;
              error = restored.error;
            }
          }
        }

        if (recoveryRequested) {
          setPasswordRecovery(true);
          setApiSessionToken(session?.access_token ?? null);
          setUserId(null);
          setAccessToken(null);
        } else if (error) {
          setUserId(null);
          setAccessToken(null);
        } else if (session?.access_token) {
          const backendReady = await verifyBackendSession(session.access_token);
          if (backendReady) {
            setApiSessionToken(session.access_token);
            setUserId(session.user?.id ?? null);
            setAccessToken(session.access_token);
          } else {
            setApiSessionToken(null);
            setUserId(null);
            setAccessToken(null);
            await supabase.auth.signOut({ scope: 'local' });
          }
        } else {
          setApiSessionToken(null);
          setUserId(null);
          setAccessToken(null);
        }
      } catch {
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION is handled by checkSession() above — skip to avoid double render
      if (event === 'INITIAL_SESSION') return;

      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isPasswordRecoveryUrl())) {
        setPasswordRecovery(true);
        setApiSessionToken(session?.access_token ?? null);
        setUserId(null);
        setAccessToken(null);
        if (window.location.pathname !== '/reset-password') {
          window.history.replaceState({}, '', '/reset-password?mode=recovery');
        }
        return;
      }

      // Fresh sign-ins are admitted only by handleLoginSuccess after its
      // backend check. Token refreshes can update an already admitted session.
      if (event === 'TOKEN_REFRESHED' && session?.access_token) {
        setApiSessionToken(session.access_token);
        setUserId(session.user?.id ?? null);
        setAccessToken(session.access_token);
      } else if (!session) {
        setApiSessionToken(null);
        invalidatePermissionsCache();
        setUserId(null);
        setAccessToken(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Install PWA service
  useEffect(() => {
    PWAService.initialize();
  }, []);

  // Seed master_data_config once per browser install — skip on subsequent loads
  useEffect(() => {
    const FLAG = 'jl_master_seeded_v1';
    if (localStorage.getItem(FLAG)) return;
    void supabase.from('master_data_config').upsert(
      MASTER_DATA_SEED_RECORDS,
      { onConflict: 'config_group,config_key', ignoreDuplicates: true }
    ).then(() => localStorage.setItem(FLAG, '1'));
  }, []);

  const handleLoginSuccess = async (token: string, authenticatedUserId: string): Promise<boolean> => {
    setLogoutReason(null);
    const backendReady = await verifyBackendSession(token);
    if (!backendReady) {
      setApiSessionToken(null);
      setUserId(null);
      setAccessToken(null);
      await supabase.auth.signOut({ scope: 'local' });
      return false;
    }

    setApiSessionToken(token);
    setUserId(authenticatedUserId);
    setAccessToken(token);
    return true;
  };

  const handlePasswordResetComplete = useCallback(async () => {
    setApiSessionToken(null);
    setAccessToken(null);
    setUserId(null);
    await supabase.auth.signOut({ scope: 'local' });
    window.history.replaceState({}, '', '/');
    setPasswordRecovery(false);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      invalidatePermissionsCache();
      setApiSessionToken(null);
      await supabase.auth.signOut();
      // Clear all SW caches so no previous user's API responses survive
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
      setAccessToken(null);
    } catch (error) {
      console.error('Error during logout:', error);
      setAccessToken(null);
    }
  }, []);

  // Session idle timeout — warns after 15 min, auto-logs out after 2 more min
  // Only active when a user is logged in (accessToken present)
  const handleIdleTimeout = useCallback(async () => {
    setLogoutReason('idle_timeout');
    await handleLogout();
  }, [handleLogout]);

  const { warningActive, secondsLeft, extendSession } = useSessionTimeout(handleIdleTimeout, !!accessToken);

  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handler = () => setShowShortcuts(true);
    window.addEventListener('show-shortcuts', handler);
    return () => window.removeEventListener('show-shortcuts', handler);
  }, []);

  // Create router with logout handler - memoized to prevent unnecessary recreations
  const router = useMemo(() => {
    if (!accessToken) return null;
    return createAppRouter({ accessToken, onLogout: handleLogout });
  }, [accessToken, handleLogout]);

  // Public route bypass — must be before any early return so hook count is stable
  const isPreboarding = useMemo(
    () => window.location.pathname === '/preboarding' && window.location.search.includes('token='),
    [accessToken],
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Loading Portal...</p>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <>
      {isPreboarding ? (
        <PreboardingPortal />
      ) : accessToken && router ? (
        <DisplaySettingsProvider>
          {/* key remounts UserProvider on token change so user data refreshes */}
          <UserProvider key={userId ?? 'anon'} accessToken={accessToken}>
            <RouterProvider router={router} />
          </UserProvider>
        </DisplaySettingsProvider>
      ) : (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onPasswordResetComplete={handlePasswordResetComplete}
          logoutReason={logoutReason}
          passwordRecovery={passwordRecovery}
        />
      )}
      <Toaster />
      <PWAStatus />
      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      {accessToken && warningActive && (
        <SessionTimeoutWarning
          secondsLeft={secondsLeft}
          onKeepWorking={extendSession}
          onSignOut={handleLogout}
        />
      )}
    </>
  );
}
