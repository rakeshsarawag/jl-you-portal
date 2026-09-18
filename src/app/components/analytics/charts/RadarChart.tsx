/**
 * Radar Chart Component
 * Wrapper around recharts RadarChart
 */

import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface RadarChartProps {
  data: any[];
  dataKeys: string[];
  angleKey: string;
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

export function RadarChart({
  data,
  dataKeys,
  angleKey,
  title,
  height = 300,
  colors = DEFAULT_COLORS,
}: RadarChartProps) {
  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsRadarChart data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey={angleKey}
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <PolarRadiusAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
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
          {dataKeys.map((key, index) => (
            <Radar
              key={key}
              name={key}
              dataKey={key}
              stroke={colors[index % colors.length]}
              fill={colors[index % colors.length]}
              fillOpacity={0.6}
            />
          ))}
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
