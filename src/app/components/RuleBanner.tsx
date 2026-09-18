import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

type BannerVariant = 'error' | 'warning' | 'info' | 'success';

interface RuleBannerProps {
  variant: BannerVariant;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

const VARIANTS = {
  error:   { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: AlertCircle,    iconColor: 'text-red-500' },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: AlertTriangle, iconColor: 'text-yellow-500' },
  info:    { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: Info,         iconColor: 'text-blue-500' },
  success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: CheckCircle2, iconColor: 'text-green-500' },
};

export function RuleBanner({ variant, message, onDismiss, className = '' }: RuleBannerProps) {
  const { bg, border, text, icon: Icon, iconColor } = VARIANTS[variant];
  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${bg} border ${border} rounded-xl ${className}`} role="alert">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
      <p className={`text-sm flex-1 ${text}`}>{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className={`shrink-0 ${text} hover:opacity-70`}>
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default RuleBanner;
