import { format } from 'date-fns'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
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

interface LineChartProps {
  data: DataPoint[]
  dataKey?: string
  name?: string
  color?: string
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  showDots?: boolean
  formatValue?: (value: number) => string
  formatXAxis?: (dateStr: string) => string
}

export function LineChart({
  data,
  dataKey = 'value',
  name = 'Value',
  color = chartColors.primary,
  height = 256,
  showGrid = true,
  showLegend = false,
  showDots = false,
  formatValue,
  formatXAxis = (dateStr) => format(new Date(dateStr), 'MM/dd'),
}: LineChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
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
          <Line
            type="monotone"
            dataKey={dataKey}
            name={name}
            stroke={color}
            strokeWidth={2}
            dot={showDots}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}
