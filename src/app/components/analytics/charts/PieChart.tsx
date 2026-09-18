/**
 * Pie Chart Component
 * Wrapper around recharts PieChart
 */

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface PieChartProps {
  data: any[];
  dataKey: string;
  nameKey: string;
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
  '#06b6d4', // cyan
  '#f97316', // orange
];

export function PieChart({
  data,
  dataKey,
  nameKey,
  title,
  height = 300,
  colors = DEFAULT_COLORS,
}: PieChartProps) {
  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={(entry) => `${entry[nameKey]}: ${entry[dataKey]}`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
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
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}
