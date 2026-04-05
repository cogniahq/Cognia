export interface OrganizationSearchHighlightSegment {
  text: string
  isMatch: boolean
}

export function getOrganizationSearchHighlightTerms(
  query?: string | null
): string[]

export function buildOrganizationSearchHighlights(
  text?: string | null,
  query?: string | null
): OrganizationSearchHighlightSegment[]
