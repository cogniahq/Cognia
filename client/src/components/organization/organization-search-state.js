const SEARCH_PLACEHOLDER =
  "Ask anything about your documents and browsing memories..."

export function getOrganizationSearchState(_input) {
  return {
    isDisabled: false,
    placeholder: SEARCH_PLACEHOLDER,
  }
}
