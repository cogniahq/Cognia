const SUMMARY_LOADING_STEPS = [
  {
    label: "Reviewing evidence",
    description:
      "De-duplicating overlapping matches and keeping the strongest chunks in play.",
  },
  {
    label: "Linking citations",
    description:
      "Matching each claim back to the exact files that support it.",
  },
  {
    label: "Drafting summary",
    description:
      "Assembling a concise answer from the retrieved evidence.",
  },
]

const SOURCE_TYPE_LABELS = {
  DOCUMENT: "Documents",
  EXTENSION: "Browsing",
  BROWSING: "Browsing",
  INTEGRATION: "Integrations",
}

function normalizeLabel(value) {
  return typeof value === "string" ? value.trim() : ""
}

function getSourceTypeLabel(value) {
  const normalized = normalizeLabel(value).toUpperCase()
  return SOURCE_TYPE_LABELS[normalized] || ""
}

function getSourceLabel(result) {
  return (
    normalizeLabel(result?.documentName) ||
    normalizeLabel(result?.title) ||
    normalizeLabel(result?.url) ||
    getSourceTypeLabel(result?.sourceType)
  )
}

export function getOrganizationSearchLoadingState(input) {
  const results = Array.isArray(input?.results) ? input.results : []
  const phaseIndex = Number.isFinite(input?.phaseIndex)
    ? Math.abs(Math.floor(input.phaseIndex))
    : 0
  const activeStepIndex = phaseIndex % SUMMARY_LOADING_STEPS.length
  const activeStep = SUMMARY_LOADING_STEPS[activeStepIndex]
  const queryLabel = normalizeLabel(input?.query)
  const filterLabel = normalizeLabel(input?.filterLabel) || "All Sources"
  const uniqueSourceMix = Array.from(
    new Set(results.map((result) => getSourceTypeLabel(result?.sourceType)).filter(Boolean))
  )
  const uniqueSourceLabels = Array.from(
    new Set(results.map((result) => getSourceLabel(result)).filter(Boolean))
  )

  return {
    activeStep,
    activeStepIndex,
    progressValue: (activeStepIndex + 1) / SUMMARY_LOADING_STEPS.length,
    progressLabel: `${activeStepIndex + 1}/${SUMMARY_LOADING_STEPS.length}`,
    queryLabel,
    filterLabel,
    metrics: [
      {
        label: "Retrieved",
        value: String(results.length),
      },
      {
        label: "Source Mix",
        value: uniqueSourceMix.join(" + ") || "Waiting",
      },
      {
        label: "Filter",
        value: filterLabel,
      },
    ],
    sourceLabels: uniqueSourceLabels.slice(0, 4),
    remainingSourceCount: Math.max(0, uniqueSourceLabels.length - 4),
    steps: SUMMARY_LOADING_STEPS.map((step, index) => ({
      ...step,
      isActive: index === activeStepIndex,
      isComplete: index < activeStepIndex,
    })),
    skeletonWidths: ["94%", "78%", "88%"],
  }
}
