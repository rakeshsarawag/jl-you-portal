import { Outlet, useLocation } from 'react-router';
import { UserProvider } from '../context/UserContext';
import { MasterDataProvider } from '../context/MasterDataContext';
import { UnsavedChangesProvider } from '../context/UnsavedChangesContext';
import { Toaster } from './ui/sonner';
import { useEffect, useState } from 'react';
import { API_BASE } from '../utils/constants';
import { AlertTriangle, X } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { useLocale } from '../../i18n/LocaleContext';

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
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
        setOffline(!res.ok && res.status === 404);
      } catch {
        setOffline(true);
      }
    };
    check();
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

  return (
    <UserProvider key={accessToken} accessToken={accessToken}>
      <MasterDataProvider key={accessToken} accessToken={accessToken}>
        <UnsavedChangesProvider key={accessToken}>
          <ScrollToTop />
          <AppHeader onLogout={onLogout} />
          <ServerStatusBanner />
          {/* key={locale} forces the Outlet subtree to remount on language change,
              ensuring all t() calls in route components re-execute with the new locale */}
          <div key={locale} className="pt-12">
            <Outlet />
          </div>
          <Toaster />
        </UnsavedChangesProvider>
      </MasterDataProvider>
    </UserProvider>
  );
}
