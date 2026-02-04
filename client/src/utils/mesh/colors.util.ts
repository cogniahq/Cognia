const nodeColors = {
  manual: "#22c55e",
  browser: "#3b82f6",
  extension: "#3b82f6",
  reasoning: "#a855f7",
  ai: "#a855f7",
  // Integration sources
  integration: "#f59e0b", // amber
  google_drive: "#f59e0b",
  slack: "#f59e0b",
  notion: "#f59e0b",
  github: "#f59e0b",
} as Record<string, string>

export function resolveNodeColor(rawType?: string, url?: string): string {
  const key = (rawType || "").toLowerCase()
  const href = (url || "").toLowerCase()

  if (key && nodeColors[key]) {
    return nodeColors[key]
  }

  if (href) {
    if (/github\.com|gitlab\.com|bitbucket\.org/.test(href)) return "#3b82f6"
    if (/npmjs\.com|pypi\.org|crates\.io|rubygems\.org/.test(href))
      return "#22c55e"
    if (/docs\.|developer\.|readthedocs|mdn\.|dev\.docs|learn\./.test(href))
      return "#22c55e"
    if (/youtube\.com|youtu\.be|vimeo\.com/.test(href)) return "#3b82f6"
    if (/mail\.google\.com|gmail\.com|outlook\.live\.com/.test(href))
      return "#22c55e"
  }

  return nodeColors[key] || "#6b7280"
}
