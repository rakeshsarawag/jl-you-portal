import { Outlet, useLocation } from 'react-router';
import { MasterDataProvider } from '../context/MasterDataContext';
import { ValueHelpsProvider } from '../context/ValueHelpsContext';
import { EmployeesProvider } from '../context/EmployeesContext';
import { UnsavedChangesProvider } from '../context/UnsavedChangesContext';
import { Toaster } from './ui/sonner';
import { useEffect } from 'react';
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
