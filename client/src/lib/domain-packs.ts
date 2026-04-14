export type DomainPackId = "general" | "ca-firm" | "law-firm"

export interface DomainOption {
  value: string
  label: string
}

export type DomainMetadataFieldKey =
  | "artifactType"
  | "authority"
  | "forum"
  | "outcome"
  | "practiceArea"

export interface DomainFilterDefinition {
  key: DomainMetadataFieldKey
  label: string
  options: DomainOption[]
}

export interface DomainPackDefinition {
  id: DomainPackId
  label: string
  shortLabel: string
  description: string
  artifactTypeOptions: DomainOption[]
  filterDefinitions: DomainFilterDefinition[]
}

export interface DomainDocumentMetadata {
  domainPack?: DomainPackId
  artifactType?: string
  engagementName?: string
  engagementType?: string
  authority?: string
  forum?: string
  outcome?: string
  practiceArea?: string
  tags?: string[]
}

export interface SearchMetadataFilters {
  artifactTypes?: string[]
  authorities?: string[]
  forums?: string[]
  outcomes?: string[]
  practiceAreas?: string[]
}

export const DOMAIN_FILTER_TO_SEARCH_KEY = {
  artifactType: "artifactTypes",
  authority: "authorities",
  forum: "forums",
  outcome: "outcomes",
  practiceArea: "practiceAreas",
} as const

const OUTCOME_OPTIONS: DomainOption[] = [
  { value: "favourable", label: "Favourable" },
  { value: "mixed", label: "Mixed" },
  { value: "unfavourable", label: "Unfavourable" },
  { value: "pending", label: "Pending" },
]

export const DOMAIN_PACKS: Record<DomainPackId, DomainPackDefinition> = {
  general: {
    id: "general",
    label: "General Knowledge Workspace",
    shortLabel: "General",
    description: "Flexible document intelligence for mixed professional work.",
    artifactTypeOptions: [
      { value: "report", label: "Report" },
      { value: "memo", label: "Memo" },
      { value: "policy", label: "Policy" },
      { value: "research-note", label: "Research Note" },
      { value: "meeting-note", label: "Meeting Note" },
    ],
    filterDefinitions: [
      {
        key: "artifactType",
        label: "Artifact Type",
        options: [
          { value: "report", label: "Report" },
          { value: "memo", label: "Memo" },
          { value: "policy", label: "Policy" },
          { value: "research-note", label: "Research Note" },
          { value: "meeting-note", label: "Meeting Note" },
        ],
      },
    ],
  },
  "ca-firm": {
    id: "ca-firm",
    label: "CA / Tax Advisory Workspace",
    shortLabel: "CA Firm",
    description:
      "Structured for notices, submissions, orders, and tax authorities.",
    artifactTypeOptions: [
      { value: "notice", label: "Notice" },
      { value: "assessment-order", label: "Assessment Order" },
      { value: "appeal-memo", label: "Appeal Memo" },
      { value: "written-submission", label: "Written Submission" },
      { value: "case-law", label: "Case Law" },
      { value: "circular", label: "Circular / Instruction" },
    ],
    filterDefinitions: [
      {
        key: "artifactType",
        label: "Artifact Type",
        options: [
          { value: "notice", label: "Notice" },
          { value: "assessment-order", label: "Assessment Order" },
          { value: "appeal-memo", label: "Appeal Memo" },
          { value: "written-submission", label: "Written Submission" },
          { value: "case-law", label: "Case Law" },
          { value: "circular", label: "Circular / Instruction" },
        ],
      },
      {
        key: "authority",
        label: "Authority",
        options: [
          { value: "ao", label: "Assessing Officer" },
          { value: "cit-a", label: "CIT(A)" },
          { value: "itat", label: "ITAT" },
          { value: "high-court", label: "High Court" },
          { value: "supreme-court", label: "Supreme Court" },
        ],
      },
      {
        key: "outcome",
        label: "Outcome",
        options: OUTCOME_OPTIONS,
      },
    ],
  },
  "law-firm": {
    id: "law-firm",
    label: "Law Firm Workspace",
    shortLabel: "Law Firm",
    description:
      "Structured for pleadings, precedents, judgments, and forums.",
    artifactTypeOptions: [
      { value: "pleading", label: "Pleading" },
      { value: "written-submission", label: "Written Submission" },
      { value: "judgment", label: "Judgment / Order" },
      { value: "precedent", label: "Internal Precedent" },
      { value: "contract", label: "Contract" },
      { value: "research-note", label: "Research Note" },
    ],
    filterDefinitions: [
      {
        key: "artifactType",
        label: "Artifact Type",
        options: [
          { value: "pleading", label: "Pleading" },
          { value: "written-submission", label: "Written Submission" },
          { value: "judgment", label: "Judgment / Order" },
          { value: "precedent", label: "Internal Precedent" },
          { value: "contract", label: "Contract" },
          { value: "research-note", label: "Research Note" },
        ],
      },
      {
        key: "forum",
        label: "Forum",
        options: [
          { value: "tribunal", label: "Tribunal" },
          { value: "district-court", label: "District Court" },
          { value: "high-court", label: "High Court" },
          { value: "supreme-court", label: "Supreme Court" },
          { value: "arbitration", label: "Arbitration" },
        ],
      },
      {
        key: "outcome",
        label: "Outcome",
        options: OUTCOME_OPTIONS,
      },
      {
        key: "practiceArea",
        label: "Practice Area",
        options: [
          { value: "litigation", label: "Litigation" },
          { value: "arbitration", label: "Arbitration" },
          { value: "corporate", label: "Corporate" },
          { value: "commercial", label: "Commercial" },
          { value: "tax", label: "Tax" },
        ],
      },
    ],
  },
}

export function normalizeDomainPack(value: unknown): DomainPackId {
  if (typeof value === "string" && value in DOMAIN_PACKS) {
    return value as DomainPackId
  }

  return "general"
}

export function getDomainPackDefinition(
  value: DomainPackId | string | null | undefined
): DomainPackDefinition {
  return DOMAIN_PACKS[normalizeDomainPack(value)]
}

export function getDomainOptionLabel(
  packId: DomainPackId,
  key: DomainMetadataFieldKey,
  value: string
): string {
  const definition = getDomainPackDefinition(packId)
  const options =
    key === "artifactType"
      ? definition.artifactTypeOptions
      : definition.filterDefinitions.find((filter) => filter.key === key)
          ?.options || []

  return options.find((option) => option.value === value)?.label || value
}

export function hasActiveSearchMetadataFilters(
  filters: SearchMetadataFilters | undefined
): boolean {
  if (!filters) {
    return false
  }

  return Object.values(filters).some(
    (value) => Array.isArray(value) && value.length > 0
  )
}

export function getDomainMetadataBadges(
  packId: DomainPackId,
  metadata: DomainDocumentMetadata | Record<string, unknown> | null | undefined
): Array<{ key: string; label: string }> {
  if (!metadata || typeof metadata !== "object") {
    return []
  }

  const domainMetadata = metadata as DomainDocumentMetadata
  const badgeEntries: Array<[string, string]> = []

  if (domainMetadata.artifactType) {
    badgeEntries.push([
      "artifactType",
      getDomainOptionLabel(packId, "artifactType", domainMetadata.artifactType),
    ])
  }
  if (domainMetadata.authority) {
    badgeEntries.push([
      "authority",
      getDomainOptionLabel(packId, "authority", domainMetadata.authority),
    ])
  }
  if (domainMetadata.forum) {
    badgeEntries.push([
      "forum",
      getDomainOptionLabel(packId, "forum", domainMetadata.forum),
    ])
  }
  if (domainMetadata.outcome) {
    badgeEntries.push([
      "outcome",
      getDomainOptionLabel(packId, "outcome", domainMetadata.outcome),
    ])
  }
  if (domainMetadata.practiceArea) {
    badgeEntries.push([
      "practiceArea",
      getDomainOptionLabel(
        packId,
        "practiceArea",
        domainMetadata.practiceArea
      ),
    ])
  }

  return badgeEntries.map(([key, label]) => ({ key, label }))
}
