/**
 * Composed Chart Component
 * Wrapper around recharts ComposedChart (combines multiple chart types)
 */

import {
  ComposedChart as RechartsComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ComposedChartProps {
  data: any[];
  xAxisKey: string;
  bars?: string[];
  lines?: string[];
  areas?: string[];
  title?: string;
  height?: number;
  colors?: string[];
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
];

export function ComposedChart({
  data,
  xAxisKey,
  bars = [],
  lines = [],
  areas = [],
  title,
  height = 300,
  colors = DEFAULT_COLORS,
}: ComposedChartProps) {
  let colorIndex = 0;

  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey={xAxisKey}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            stroke="#9ca3af"
          />
          <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            iconType="circle"
          />
          {areas.map((key) => {
            const color = colors[colorIndex++ % colors.length];
            return (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                fill={color}
                stroke={color}
                fillOpacity={0.6}
              />
            );
          })}
          {bars.map((key) => {
            const color = colors[colorIndex++ % colors.length];
            return (
              <Bar
                key={key}
                dataKey={key}
                fill={color}
                radius={[4, 4, 0, 0]}
              />
            );
          })}
          {lines.map((key) => {
            const color = colors[colorIndex++ % colors.length];
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={{ fill: color, r: 4 }}
              />
            );
          })}
        </RechartsComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
