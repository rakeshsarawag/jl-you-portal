/**
 * KPI Card Component
 * Displays key performance indicators with trend information
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  loading?: boolean;
  colorClass?: string;
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  loading = false,
  colorClass = 'text-blue-600'
}: KPICardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            <div className="h-4 w-24 bg-gray-200 animate-pulse rounded"></div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-8 w-32 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-3 w-20 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend
    ? trend.isPositive
      ? TrendingUp
      : TrendingDown
    : Minus;

  const trendColorClass = trend
    ? trend.isPositive
      ? 'text-green-600 bg-green-50'
      : 'text-red-600 bg-red-50'
    : 'text-gray-600 bg-gray-50';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
          <span>{title}</span>
          {Icon && <Icon className={`h-4 w-4 ${colorClass}`} />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className={`text-2xl font-bold ${colorClass}`}>
            {value}
          </div>
          {(trend || subtitle) && (
            <div className="flex items-center gap-2">
              {trend && (
                <Badge
                  variant="secondary"
                  className={`${trendColorClass} border-0 text-xs`}
                >
                  <TrendIcon className="h-3 w-3 mr-1" />
                  {Math.abs(trend.value)}%
                </Badge>
              )}
              {subtitle && (
                <span className="text-xs text-gray-500">{subtitle}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
