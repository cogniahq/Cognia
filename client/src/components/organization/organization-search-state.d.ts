export interface OrganizationSearchStateInput {
  documentCount: number
}

export interface OrganizationSearchState {
  isDisabled: boolean
  placeholder: string
}

export function getOrganizationSearchState(
  input: OrganizationSearchStateInput
): OrganizationSearchState
