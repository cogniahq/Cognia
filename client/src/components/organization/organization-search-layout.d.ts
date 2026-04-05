export interface OrganizationSearchLayoutInput {
  hasSummary: boolean
  hasResults: boolean
}

export type OrganizationSearchSection = "summary" | "results"

export function getOrganizationSearchSectionOrder(
  input: OrganizationSearchLayoutInput
): OrganizationSearchSection[]
