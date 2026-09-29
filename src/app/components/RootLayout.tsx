import { Outlet, useLocation } from 'react-router';
import { MasterDataProvider } from '../context/MasterDataContext';
import { ValueHelpsProvider } from '../context/ValueHelpsContext';
import { EmployeesProvider } from '../context/EmployeesContext';
import { UnsavedChangesProvider } from '../context/UnsavedChangesContext';
import { Toaster } from './ui/sonner';
import { useEffect, useState } from 'react';
import { API_BASE } from '../utils/constants';
import { AlertTriangle, X } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { useLocale } from '../../i18n/LocaleContext';
import { AppSidebar } from './AppSidebar';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function ServerStatusBanner() {
  const [offline, setOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Defer health check so it doesn't compete with critical data fetches on mount
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
        setOffline(!res.ok && res.status === 404);
      } catch {
        setOffline(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!offline || dismissed) return null;

  return (
    <div className="fixed top-12 left-0 right-0 z-40 bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 shadow-md">
      <div className="flex items-center gap-2 text-xs font-medium">
        <AlertTriangle size={14} className="shrink-0" />
        <span>
          Backend server not reachable — deploy the Edge Function from <strong>Make Settings → Supabase</strong> to restore all data.
        </span>
      </div>
      <button onClick={() => setDismissed(true)} className="shrink-0 hover:opacity-70 transition-opacity" aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

interface RootLayoutProps {
  accessToken: string;
  onLogout: () => void;
}

export function RootLayout({ accessToken, onLogout }: RootLayoutProps) {
  const { locale } = useLocale();

  // UserProvider is in App.tsx (single instance, shared across router + notification pages).
  // RootLayout owns MasterDataProvider and ValueHelpsProvider which need accessToken.
  return (
    <MasterDataProvider key={accessToken} accessToken={accessToken}>
      <ValueHelpsProvider key={accessToken}>
        <EmployeesProvider>
        <UnsavedChangesProvider key={accessToken}>
          <ScrollToTop />
          <AppHeader onLogout={onLogout} />
          <ServerStatusBanner />
          <AppSidebar onLogout={onLogout} />
          {/* margin-left driven by --global-sidebar-w CSS var; AppSidebar sets it directly */}
          <div
            key={locale}
            className="pt-12 transition-[margin-left] duration-200 ease-in-out"
            style={{ marginLeft: 'var(--global-sidebar-w, 0px)' }}
          >
            <Outlet />
          </div>
          <Toaster />
        </UnsavedChangesProvider>
        </EmployeesProvider>
      </ValueHelpsProvider>
    </MasterDataProvider>
  );
}
