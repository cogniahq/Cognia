import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import { chartTheme, chartColors, chartColorArray, formatAxisNumber } from '@/lib/chart-config'

interface DataPoint {
  name: string
  value: number
}

interface BarChartProps {
  data: DataPoint[]
  dataKey?: string
  nameKey?: string
  color?: string
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  layout?: 'horizontal' | 'vertical'
  multiColor?: boolean
  formatValue?: (value: number) => string
  barSize?: number
}

export function BarChart({
  data,
  dataKey = 'value',
  nameKey = 'name',
  color = chartColors.primary,
  height = 256,
  showGrid = true,
  showLegend = false,
  layout = 'horizontal',
  multiColor = false,
  formatValue,
  barSize = 20,
}: BarChartProps) {
  const isVertical = layout === 'vertical'

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={isVertical ? 'vertical' : 'horizontal'}
          margin={{ top: 10, right: 10, left: isVertical ? 80 : 0, bottom: 0 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray={chartTheme.grid.strokeDasharray}
              stroke={chartTheme.grid.stroke}
              horizontal={!isVertical}
              vertical={isVertical}
            />
          )}
          {isVertical ? (
            <>
              <XAxis
                type="number"
                tick={chartTheme.axis.tick}
                axisLine={{ stroke: chartTheme.axis.line.stroke }}
                tickLine={{ stroke: chartTheme.axis.line.stroke }}
                tickFormatter={formatValue || formatAxisNumber}
              />
              <YAxis
                type="category"
                dataKey={nameKey}
                tick={chartTheme.axis.tick}
                axisLine={{ stroke: chartTheme.axis.line.stroke }}
                tickLine={{ stroke: chartTheme.axis.line.stroke }}
                width={75}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={nameKey}
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
            </>
          )}
          <Tooltip
            contentStyle={chartTheme.tooltip.contentStyle}
            labelStyle={chartTheme.tooltip.labelStyle}
            formatter={(value: number) => [formatValue ? formatValue(value) : value.toLocaleString()]}
          />
          {showLegend && <Legend wrapperStyle={chartTheme.legend.wrapperStyle} />}
          <Bar dataKey={dataKey} barSize={barSize} radius={[4, 4, 0, 0]}>
            {multiColor
              ? data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={chartColorArray[index % chartColorArray.length]} />
                ))
              : <Cell fill={color} />}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}
