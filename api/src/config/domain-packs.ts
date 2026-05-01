export type DomainPackId = 'general' | 'ca-firm' | 'law-firm' | 'tax-audit-firm'

export interface DomainOption {
  value: string
  label: string
}

export interface DomainFilterDefinition {
  key: 'artifactType' | 'authority' | 'forum' | 'outcome' | 'practiceArea'
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

export interface DomainDocumentMetadata extends Record<string, unknown> {
  domainPack: DomainPackId
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

const GENERAL_ARTIFACT_TYPES: DomainOption[] = [
  { value: 'report', label: 'Report' },
  { value: 'memo', label: 'Memo' },
  { value: 'policy', label: 'Policy' },
  { value: 'research-note', label: 'Research Note' },
  { value: 'meeting-note', label: 'Meeting Note' },
]

const CA_ARTIFACT_TYPES: DomainOption[] = [
  { value: 'notice', label: 'Notice' },
  { value: 'assessment-order', label: 'Assessment Order' },
  { value: 'appeal-memo', label: 'Appeal Memo' },
  { value: 'written-submission', label: 'Written Submission' },
  { value: 'case-law', label: 'Case Law' },
  { value: 'circular', label: 'Circular / Instruction' },
]

const CA_AUTHORITIES: DomainOption[] = [
  { value: 'ao', label: 'Assessing Officer' },
  { value: 'cit-a', label: 'CIT(A)' },
  { value: 'itat', label: 'ITAT' },
  { value: 'high-court', label: 'High Court' },
  { value: 'supreme-court', label: 'Supreme Court' },
]

const LAW_ARTIFACT_TYPES: DomainOption[] = [
  { value: 'pleading', label: 'Pleading' },
  { value: 'written-submission', label: 'Written Submission' },
  { value: 'judgment', label: 'Judgment / Order' },
  { value: 'precedent', label: 'Internal Precedent' },
  { value: 'contract', label: 'Contract' },
  { value: 'research-note', label: 'Research Note' },
]

const LAW_FORUMS: DomainOption[] = [
  { value: 'tribunal', label: 'Tribunal' },
  { value: 'district-court', label: 'District Court' },
  { value: 'high-court', label: 'High Court' },
  { value: 'supreme-court', label: 'Supreme Court' },
  { value: 'arbitration', label: 'Arbitration' },
]

const OUTCOMES: DomainOption[] = [
  { value: 'favourable', label: 'Favourable' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'unfavourable', label: 'Unfavourable' },
  { value: 'pending', label: 'Pending' },
]

const LAW_PRACTICE_AREAS: DomainOption[] = [
  { value: 'litigation', label: 'Litigation' },
  { value: 'arbitration', label: 'Arbitration' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'tax', label: 'Tax' },
]

const TAX_AUDIT_ARTIFACT_TYPES: DomainOption[] = [
  { value: 'notice', label: 'Notice' },
  { value: 'assessment-order', label: 'Assessment Order' },
  { value: 'appeal-memo', label: 'Appeal Memo' },
  { value: 'written-submission', label: 'Written Submission' },
  { value: 'tax-opinion', label: 'Tax Opinion' },
  { value: 'audit-opinion', label: 'Audit Opinion' },
  { value: 'case-law', label: 'Case Law' },
  { value: 'circular-notification', label: 'Circular / Notification' },
  { value: 'workpaper', label: 'Workpaper' },
  { value: 'audit-checklist', label: 'Audit Checklist' },
  { value: 'trial-balance', label: 'Trial Balance' },
  { value: 'ledger', label: 'Ledger' },
  { value: 'financial-statement', label: 'Financial Statement' },
  { value: 'firm-precedent', label: 'Firm Precedent' },
]

const TAX_AUDIT_AUTHORITIES: DomainOption[] = [
  { value: 'assessing-officer', label: 'Assessing Officer' },
  { value: 'cit-a', label: 'CIT(A)' },
  { value: 'itat', label: 'ITAT' },
  { value: 'high-court', label: 'High Court' },
  { value: 'supreme-court', label: 'Supreme Court' },
  { value: 'gst-officer', label: 'GST Officer' },
  { value: 'gst-appellate-authority', label: 'GST Appellate Authority' },
  { value: 'roc', label: 'ROC / MCA' },
  { value: 'management', label: 'Management' },
  { value: 'audit-committee', label: 'Audit Committee' },
]

const TAX_AUDIT_PRACTICE_AREAS: DomainOption[] = [
  { value: 'income-tax', label: 'Income Tax' },
  { value: 'gst', label: 'GST' },
  { value: 'tds', label: 'TDS' },
  { value: 'transfer-pricing', label: 'Transfer Pricing' },
  { value: 'statutory-audit', label: 'Statutory Audit' },
  { value: 'internal-audit', label: 'Internal Audit' },
  { value: 'financial-diligence', label: 'Financial Diligence' },
]

export const DOMAIN_PACKS: Record<DomainPackId, DomainPackDefinition> = {
  general: {
    id: 'general',
    label: 'General Knowledge Workspace',
    shortLabel: 'General',
    description: 'Flexible document intelligence for mixed professional work.',
    artifactTypeOptions: GENERAL_ARTIFACT_TYPES,
    filterDefinitions: [
      {
        key: 'artifactType',
        label: 'Artifact Type',
        options: GENERAL_ARTIFACT_TYPES,
      },
    ],
  },
  'ca-firm': {
    id: 'ca-firm',
    label: 'CA / Tax Advisory Workspace',
    shortLabel: 'CA Firm',
    description: 'Structured for notices, submissions, orders, and tax authorities.',
    artifactTypeOptions: CA_ARTIFACT_TYPES,
    filterDefinitions: [
      {
        key: 'artifactType',
        label: 'Artifact Type',
        options: CA_ARTIFACT_TYPES,
      },
      {
        key: 'authority',
        label: 'Authority',
        options: CA_AUTHORITIES,
      },
      {
        key: 'outcome',
        label: 'Outcome',
        options: OUTCOMES,
      },
    ],
  },
  'law-firm': {
    id: 'law-firm',
    label: 'Law Firm Workspace',
    shortLabel: 'Law Firm',
    description: 'Structured for pleadings, precedents, judgments, and forums.',
    artifactTypeOptions: LAW_ARTIFACT_TYPES,
    filterDefinitions: [
      {
        key: 'artifactType',
        label: 'Artifact Type',
        options: LAW_ARTIFACT_TYPES,
      },
      {
        key: 'forum',
        label: 'Forum',
        options: LAW_FORUMS,
      },
      {
        key: 'outcome',
        label: 'Outcome',
        options: OUTCOMES,
      },
      {
        key: 'practiceArea',
        label: 'Practice Area',
        options: LAW_PRACTICE_AREAS,
      },
    ],
  },
  'tax-audit-firm': {
    id: 'tax-audit-firm',
    label: 'Tax & Audit Firm Workspace',
    shortLabel: 'Tax & Audit',
    description:
      'Structured for notices, opinions, sections, standards, workpapers, and firm precedents.',
    artifactTypeOptions: TAX_AUDIT_ARTIFACT_TYPES,
    filterDefinitions: [
      {
        key: 'artifactType',
        label: 'Artifact Type',
        options: TAX_AUDIT_ARTIFACT_TYPES,
      },
      {
        key: 'authority',
        label: 'Authority',
        options: TAX_AUDIT_AUTHORITIES,
      },
      {
        key: 'outcome',
        label: 'Outcome',
        options: OUTCOMES,
      },
      {
        key: 'practiceArea',
        label: 'Practice Area',
        options: TAX_AUDIT_PRACTICE_AREAS,
      },
    ],
  },
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed || undefined
}

function normalizeOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const normalized = value
    .map(item => normalizeOptionalString(item))
    .filter((item): item is string => Boolean(item))

  return normalized.length > 0 ? normalized : undefined
}

function buildAllowedValueSet(
  definition: DomainPackDefinition,
  key: DomainFilterDefinition['key']
): Set<string> {
  if (key === 'artifactType') {
    return new Set(definition.artifactTypeOptions.map(option => option.value))
  }

  const filterDefinition = definition.filterDefinitions.find(filter => filter.key === key)
  return new Set((filterDefinition?.options || []).map(option => option.value))
}

function normalizeAllowedValue(value: unknown, allowedValues: Set<string>): string | undefined {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return undefined
  }

  return allowedValues.has(normalized) ? normalized : undefined
}

function normalizeFilterValues(value: unknown): string[] | undefined {
  const normalized = normalizeOptionalStringArray(value)?.map(item => item.toLowerCase())
  return normalized && normalized.length > 0 ? normalized : undefined
}

export function isDomainPackId(value: unknown): value is DomainPackId {
  return typeof value === 'string' && value in DOMAIN_PACKS
}

export function normalizeDomainPack(value: unknown): DomainPackId {
  return isDomainPackId(value) ? value : 'general'
}

export function getDomainPackDefinition(value: unknown): DomainPackDefinition {
  return DOMAIN_PACKS[normalizeDomainPack(value)]
}

export function sanitizeDomainDocumentMetadata(
  input: unknown,
  packId: DomainPackId
): DomainDocumentMetadata {
  const metadata =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {}
  const definition = getDomainPackDefinition(packId)

  return {
    domainPack: definition.id,
    artifactType: normalizeAllowedValue(
      metadata.artifactType,
      buildAllowedValueSet(definition, 'artifactType')
    ),
    engagementName: normalizeOptionalString(metadata.engagementName),
    engagementType: normalizeOptionalString(metadata.engagementType),
    authority: normalizeAllowedValue(
      metadata.authority,
      buildAllowedValueSet(definition, 'authority')
    ),
    forum: normalizeAllowedValue(metadata.forum, buildAllowedValueSet(definition, 'forum')),
    outcome: normalizeAllowedValue(metadata.outcome, buildAllowedValueSet(definition, 'outcome')),
    practiceArea: normalizeAllowedValue(
      metadata.practiceArea,
      buildAllowedValueSet(definition, 'practiceArea')
    ),
    tags: normalizeOptionalStringArray(metadata.tags),
  }
}

export function sanitizeSearchMetadataFilters(input: unknown): SearchMetadataFilters | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined
  }

  const rawFilters = input as Record<string, unknown>
  const filters: SearchMetadataFilters = {
    artifactTypes: normalizeFilterValues(rawFilters.artifactTypes),
    authorities: normalizeFilterValues(rawFilters.authorities),
    forums: normalizeFilterValues(rawFilters.forums),
    outcomes: normalizeFilterValues(rawFilters.outcomes),
    practiceAreas: normalizeFilterValues(rawFilters.practiceAreas),
  }

  const hasValues = Object.values(filters).some(value => Array.isArray(value) && value.length > 0)
  return hasValues ? filters : undefined
}
