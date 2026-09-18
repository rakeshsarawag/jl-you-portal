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
import { MasterDataProvider } from './context/MasterDataContext';
import { ValueHelpsProvider } from './context/ValueHelpsContext';
import { useLocale } from '../i18n/LocaleContext';
import { PWAService } from './services/pwaService';
import { PWAStatus } from './components/mobile/PWAStatus';
import { supabase, MASTER_DATA_SEED_RECORDS } from './utils/constants';
import { createAppRouter } from './routes';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { SessionTimeoutWarning } from './components/SessionTimeoutWarning';
import { invalidatePermissionsCache } from './hooks/usePermissions';
import PreboardingPortal from './components/apps/PreboardingPortal';

/**
 * Main App Component
 * Handles authentication state and routing
 */
export default function App() {
  // Subscribe to locale changes — re-renders App (and the full tree) on language switch
  useLocale();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutReason, setLogoutReason] = useState<'idle_timeout' | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          setAccessToken(null);
        } else if (session?.access_token) {
          setAccessToken(session.access_token);
        } else {
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.access_token) {
        setAccessToken(session.access_token);
      } else {
        invalidatePermissionsCache();
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

  // Seed master_data_config with default policy values (idempotent — ignoreDuplicates)
  useEffect(() => {
    void supabase.from('master_data_config').upsert(
      MASTER_DATA_SEED_RECORDS,
      { onConflict: 'config_group,config_key', ignoreDuplicates: true }
    );
  }, []);

  const handleLoginSuccess = (token: string) => {
    setLogoutReason(null);
    setAccessToken(token);
  };

  const handleLogout = useCallback(async () => {
    try {
      invalidatePermissionsCache();
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

  // Public route bypass — show preboarding portal without auth
  const isPreboarding = window.location.pathname === '/preboarding' && window.location.search.includes('token=');

  // Main render
  return (
    <>
      {isPreboarding ? (
        <PreboardingPortal />
      ) : accessToken && router ? (
        <DisplaySettingsProvider>
        <UserProvider accessToken={accessToken}>
          <MasterDataProvider>
            <ValueHelpsProvider>
              <RouterProvider router={router} />
            </ValueHelpsProvider>
          </MasterDataProvider>
        </UserProvider>
        </DisplaySettingsProvider>
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} logoutReason={logoutReason} />
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
