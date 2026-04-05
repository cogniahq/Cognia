const ORGANIZATION_SEARCH_FILTERS = [
  {
    id: "ALL",
    label: "All Sources",
    sourceTypes: undefined,
  },
  {
    id: "DOCUMENTS",
    label: "Documents",
    sourceTypes: ["DOCUMENT"],
  },
  {
    id: "BROWSING",
    label: "Browsing",
    sourceTypes: ["EXTENSION"],
  },
  {
    id: "INTEGRATIONS",
    label: "Integrations",
    sourceTypes: ["INTEGRATION"],
  },
]

export function getOrganizationSearchFilters() {
  return ORGANIZATION_SEARCH_FILTERS
}

export function getOrganizationSearchSourceTypes(filterId) {
  const filter = ORGANIZATION_SEARCH_FILTERS.find((entry) => entry.id === filterId)
  return filter?.sourceTypes
}

export function getOrganizationSearchFilterLabel(filterId) {
  const filter = ORGANIZATION_SEARCH_FILTERS.find((entry) => entry.id === filterId)
  return filter?.label || ORGANIZATION_SEARCH_FILTERS[0].label
}
