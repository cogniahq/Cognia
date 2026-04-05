import type { OrganizationSearchResult } from "@/types/organization"

export interface OrganizationSearchLoadingMetric {
  label: string
  value: string
}

export interface OrganizationSearchLoadingStep {
  label: string
  description: string
  isActive: boolean
  isComplete: boolean
}

export interface OrganizationSearchLoadingState {
  activeStep: {
    label: string
    description: string
  }
  activeStepIndex: number
  progressValue: number
  progressLabel: string
  queryLabel: string
  filterLabel: string
  metrics: OrganizationSearchLoadingMetric[]
  sourceLabels: string[]
  remainingSourceCount: number
  steps: OrganizationSearchLoadingStep[]
  skeletonWidths: string[]
}

export interface OrganizationSearchLoadingInput {
  query?: string
  filterLabel?: string
  phaseIndex?: number
  results?: OrganizationSearchResult[]
}

export function getOrganizationSearchLoadingState(
  input: OrganizationSearchLoadingInput
): OrganizationSearchLoadingState
