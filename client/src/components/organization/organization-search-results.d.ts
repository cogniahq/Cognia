import type { OrganizationSearchResult } from "@/types/organization"

export interface OrganizationSearchResultsCitation {
  memoryId: string
  documentName?: string
  title?: string
  url?: string
}

export interface OrganizationSearchResultsInput {
  results?: OrganizationSearchResult[] | null
  citations?: OrganizationSearchResultsCitation[] | null
  answerJobId?: string | null
}

export function getVisibleOrganizationSearchResults(
  input: OrganizationSearchResultsInput
): OrganizationSearchResult[]
