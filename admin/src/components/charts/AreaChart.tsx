import { format } from 'date-fns'
import {
  Area,
  CartesianGrid,
  Legend,
  AreaChart as RechartsAreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { chartColors, chartTheme, formatAxisNumber } from '@/lib/chart-config'

interface DataPoint {
  date: string
  value: number
}

interface AreaChartProps {
  data: DataPoint[]
  dataKey?: string
  name?: string
  color?: string
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  gradientId?: string
  formatValue?: (value: number) => string
  formatXAxis?: (dateStr: string) => string
}

export function AreaChart({
  data,
  dataKey = 'value',
  name = 'Value',
  color = chartColors.primary,
  height = 256,
  showGrid = true,
  showLegend = false,
  gradientId = 'areaGradient',
  formatValue,
  formatXAxis = (dateStr) => format(new Date(dateStr), 'MM/dd'),
}: AreaChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showGrid && (
            <CartesianGrid
              strokeDasharray={chartTheme.grid.strokeDasharray}
              stroke={chartTheme.grid.stroke}
              vertical={false}
            />
          )}
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            tick={chartTheme.axis.tick}
            axisLine={{ stroke: chartTheme.axis.line.stroke }}
            tickLine={{ stroke: chartTheme.axis.line.stroke }}
          />
          <YAxis
            tick={chartTheme.axis.tick}
            axisLine={{ stroke: chartTheme.axis.line.stroke }}
            tickLine={{ stroke: chartTheme.axis.line.stroke }}
            tickFormatter={formatValue || formatAxisNumber}
            width={50}
          />
          <Tooltip
            contentStyle={chartTheme.tooltip.contentStyle}
            labelStyle={chartTheme.tooltip.labelStyle}
            formatter={(value: number) => [
              formatValue ? formatValue(value) : value.toLocaleString(),
              name,
            ]}
            labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
          />
          {showLegend && (
            <Legend wrapperStyle={chartTheme.legend.wrapperStyle} />
          )}
          <Area
            type="monotone"
            dataKey={dataKey}
            name={name}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  )
}
