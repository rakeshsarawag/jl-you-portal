import { ReactNode } from 'react';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  icon?: ReactNode;
  onLogout?: () => void;
}

export function AppLayout({ children, title, description, icon }: AppLayoutProps) {
  return (
    <div className="min-h-screen min-w-0 max-w-full bg-background">
      {/* Title bar — sits below the global AppHeader */}
      <div className="border-b bg-card px-3 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 w-full items-start gap-3 sm:items-center">
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground sm:text-xl">{title}</h1>
            {description && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="min-w-0 w-full max-w-full px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
