function normalizeSourceKey(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function getSourceKeys(item) {
  const keys = [
    normalizeSourceKey(item?.documentName),
    normalizeSourceKey(item?.title),
    normalizeSourceKey(item?.url),
    normalizeSourceKey(item?.memoryId),
  ].filter(Boolean)

  return Array.from(new Set(keys))
}

export function getVisibleOrganizationSearchResults(input) {
  const results = Array.isArray(input?.results) ? input.results : []
  const citations = Array.isArray(input?.citations) ? input.citations : []
  const hasPendingSummary = Boolean(input?.answerJobId)

  if (hasPendingSummary) {
    return []
  }

  if (citations.length === 0) {
    return results
  }

  const citedSourceKeys = new Set(citations.flatMap(getSourceKeys))
  if (citedSourceKeys.size === 0) {
    return results
  }

  const filteredResults = results.filter((result) =>
    getSourceKeys(result).some((key) => citedSourceKeys.has(key))
  )

  return filteredResults.length > 0 ? filteredResults : results
}
