export interface OrganizationSearchFilterOption {
  id: string
  label: string
  sourceTypes?: string[]
}

export function getOrganizationSearchFilters(): OrganizationSearchFilterOption[]

export function getOrganizationSearchSourceTypes(
  filterId?: string | null
): string[] | undefined

export function getOrganizationSearchFilterLabel(filterId?: string | null): string
