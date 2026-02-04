// Chart color palette
export const chartColors = {
  primary: 'hsl(240 5.9% 10%)',
  secondary: 'hsl(240 4.8% 35%)',
  tertiary: 'hsl(240 4.8% 55%)',
  quaternary: 'hsl(240 4.8% 75%)',
  accent: 'hsl(217 91% 60%)',
  success: 'hsl(142 76% 36%)',
  warning: 'hsl(38 92% 50%)',
  error: 'hsl(0 84% 60%)',
}

// Color array for multi-series charts
export const chartColorArray = [
  chartColors.primary,
  chartColors.accent,
  chartColors.secondary,
  chartColors.success,
  chartColors.tertiary,
  chartColors.warning,
  chartColors.quaternary,
  chartColors.error,
]

// Common chart theme configuration
export const chartTheme = {
  grid: {
    stroke: 'hsl(240 5.9% 90%)',
    strokeDasharray: '3 3',
  },
  axis: {
    tick: {
      fontSize: 11,
      fill: 'hsl(240 3.8% 46.1%)',
      fontFamily: '"IBM Plex Mono", monospace',
    },
    line: {
      stroke: 'hsl(240 5.9% 90%)',
    },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: 'hsl(0 0% 100%)',
      border: '1px solid hsl(240 5.9% 90%)',
      borderRadius: '0.5rem',
      fontSize: 12,
      fontFamily: '"IBM Plex Mono", monospace',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    },
    labelStyle: {
      fontWeight: 500,
      marginBottom: 4,
    },
  },
  legend: {
    wrapperStyle: {
      fontSize: 12,
      fontFamily: '"IBM Plex Mono", monospace',
    },
  },
}

// Format large numbers for axis labels
export function formatAxisNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return String(value)
}

// Format bytes for display
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
