import { Loader2 } from 'lucide-react';

/**
 * Full-viewport centered loading indicator.
 * Use instead of any local Spinner / LoadingState component for page-level loads.
 */
export function PageLoader({ color = 'text-primary' }: { color?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <Loader2 className={`h-10 w-10 animate-spin ${color}`} />
    </div>
  );
}

/**
 * Inline centered loader — fills its parent container vertically.
 * Use for tab panels, modals, and card bodies (not full-page loads).
 */
export function InlineLoader({ color = 'text-primary' }: { color?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full">
      <Loader2 className={`h-8 w-8 animate-spin ${color}`} />
    </div>
  );
}

export default PageLoader;
