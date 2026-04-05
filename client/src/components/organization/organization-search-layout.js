export function getOrganizationSearchSectionOrder(input) {
  const order = []

  if (input?.hasSummary) {
    order.push("summary")
  }

  if (input?.hasResults) {
    order.push("results")
  }

  return order
}
