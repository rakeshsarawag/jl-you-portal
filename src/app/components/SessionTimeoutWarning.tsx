import { X } from 'lucide-react';

interface Props {
  secondsLeft: number;
  onKeepWorking: () => void;
  onSignOut: () => void;
}

export function SessionTimeoutWarning({ secondsLeft, onKeepWorking, onSignOut }: Props) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-border">
          <h2 className="text-base font-bold text-foreground">Session Timeout Warning</h2>
          <button
            onClick={onKeepWorking}
            className="text-muted-foreground hover:text-foreground transition-colors rounded-full p-0.5 hover:bg-muted"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-border">
          <p className="text-sm text-muted-foreground text-center">
            Your session is about to timeout in{' '}
            <span className="font-bold text-foreground">{secondsLeft}</span>{' '}
            {secondsLeft === 1 ? 'second' : 'seconds'}
          </p>
          {/* Progress bar */}
          <div className="mt-4 h-1.5 w-full bg-gray-100 dark:bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${(secondsLeft / 120) * 100}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-4 px-6 py-4">
          <button
            onClick={onKeepWorking}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            Keep Working
          </button>
          <button
            onClick={onSignOut}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
