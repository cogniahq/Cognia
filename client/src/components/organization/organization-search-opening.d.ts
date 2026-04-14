export type OrganizationSearchOpenResult = {
  highlightText?: string
  content?: string
  contentPreview?: string
  documentName?: string
  title?: string
  pageNumber?: number
}

export function getOrganizationSearchOpenSnippet(input: {
  query?: string
  result?: OrganizationSearchOpenResult
}): string

export function buildOrganizationSearchOpenUrl(input: {
  url?: string
  query?: string
  result?: OrganizationSearchOpenResult
}): string
