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
    <div className="min-h-screen bg-background">
      {/* Title bar — sits below the global AppHeader */}
      <div className="border-b bg-card px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {icon && <div className="shrink-0">{icon}</div>}
          <div>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
