const SHORTCUTS = [
  { category: 'Global', key: '?', description: 'Show keyboard shortcuts' },
  { category: 'Global', key: 'Cmd+K / Ctrl+K', description: 'Open Smart Search' },
  { category: 'Global', key: 'Escape', description: 'Close modal / panel' },
  { category: 'Navigation', key: 'G then D', description: 'Go to Dashboard' },
  { category: 'Navigation', key: 'G then R', description: 'Go to Recruitment' },
  { category: 'Navigation', key: 'G then O', description: 'Go to OKR Management' },
  { category: 'Navigation', key: 'G then P', description: 'Go to Payroll' },
  { category: 'Navigation', key: 'G then I', description: 'Go to Invoices' },
  { category: 'Navigation', key: 'G then A', description: 'Go to Analytics' },
  { category: 'Notifications', key: 'N', description: 'Toggle notification panel' },
  { category: 'Lists', key: 'J / K', description: 'Navigate down / up in lists' },
  { category: 'Lists', key: 'Enter', description: 'Open selected item' },
  { category: 'Forms', key: 'Cmd+Enter', description: 'Submit form' },
  { category: 'Forms', key: 'Escape', description: 'Cancel / discard changes' },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const categories = [...new Set(SHORTCUTS.map(s => s.category))];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Press{' '}
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">?</kbd>
              {' '}anytime to toggle this panel
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            aria-label="Close keyboard shortcuts"
          >
            ✕
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
          {categories.map(cat => (
            <div key={cat}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{cat}</h3>
              <div className="space-y-1.5">
                {SHORTCUTS.filter(s => s.category === cat).map(s => (
                  <div key={s.key} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{s.description}</span>
                    <kbd className="shrink-0 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-700 dark:text-gray-300">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
