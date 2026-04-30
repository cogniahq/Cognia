function normalizeCitationKeyPart(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function getCitationSourceKey(citation) {
  const documentName = normalizeCitationKeyPart(citation?.documentName)
  const url = normalizeCitationKeyPart(citation?.url)
  const sourceType = normalizeCitationKeyPart(citation?.sourceType)

  if (documentName) {
    return `document:${sourceType}:${documentName}`
  }

  if (url) {
    return `url:${sourceType}:${url}`
  }

  return `memory:${normalizeCitationKeyPart(citation?.memoryId)}`
}

export function getVisibleOrganizationSearchCitations(input) {
  const citations = Array.isArray(input) ? input : []
  const deduplicated = []
  const citationMap = new Map()

  for (const citation of citations) {
    const key = getCitationSourceKey(citation)
    const existing = citationMap.get(key)

    if (!existing) {
      const groupedCitation = {
        ...citation,
        indices: typeof citation?.index === "number" ? [citation.index] : [],
      }
      citationMap.set(key, groupedCitation)
      deduplicated.push(groupedCitation)
      continue
    }

    if (
      typeof citation?.index === "number" &&
      !existing.indices.includes(citation.index)
    ) {
      existing.indices.push(citation.index)
    }

    if (!existing.documentName && citation?.documentName) {
      existing.documentName = citation.documentName
    }

    if (!existing.url && citation?.url) {
      existing.url = citation.url
    }

    if (!existing.sourceType && citation?.sourceType) {
      existing.sourceType = citation.sourceType
    }

    if (!existing.pageNumber && citation?.pageNumber) {
      existing.pageNumber = citation.pageNumber
    }

    if (!existing.authorEmail && citation?.authorEmail) {
      existing.authorEmail = citation.authorEmail
    }

    if (!existing.capturedAt && citation?.capturedAt) {
      existing.capturedAt = citation.capturedAt
    }
  }

  return deduplicated
}
