export interface DashboardStats {
  users: {
    total: number
    admins: number
    active30d: number
    newToday: number
    newThisWeek: number
  }
  organizations: {
    total: number
    byPlan: Record<string, number>
    newThisWeek: number
  }
  memories: {
    total: number
    newToday: number
    newThisWeek: number
    byType: Record<string, number>
    bySource: Record<string, number>
  }
  documents: {
    total: number
    byStatus: Record<string, number>
    totalSize: number
  }
  system: {
    database: boolean
    redis: boolean
    redisMemory?: string
    qdrant: boolean
    qdrantPoints: number
  }
  tokenUsage: {
    totalInput: number
    totalOutput: number
    estimatedCost: number
    todayInput: number
    todayOutput: number
  }
  activity: {
    searches24h: number
    memoriesCreated24h: number
    documentsUploaded24h: number
  }
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type UserRole = 'USER' | 'ADMIN'
export type OrgRole = 'ADMIN' | 'EDITOR' | 'VIEWER'
export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface UserListItem {
  [key: string]: unknown
  id: string
  email: string | null
  role: UserRole
  account_type: string
  created_at: string
  updated_at: string
  _count: {
    memories: number
    organization_memberships: number
    uploaded_documents: number
  }
}

export interface UserDetails extends UserListItem {
  profile: {
    static_profile_text?: string | null
    dynamic_profile_text?: string | null
  } | null
  organization_memberships: Array<{
    organization: {
      id: string
      name: string
      slug: string
    }
    role: OrgRole
  }>
  recentMemories: Array<{
    id: string
    content: string
    memory_type: string
    created_at: string
  }>
}

export interface OrgListItem {
  [key: string]: unknown
  id: string
  name: string
  slug: string
  plan: string
  industry: string | null
  team_size: string | null
  created_at: string
  _count: {
    members: number
    documents: number
    memories: number
  }
}

export interface OrgDetails extends OrgListItem {
  description: string | null
  data_residency: string
  require_2fa: boolean
  members: Array<{
    user: {
      id: string
      email: string | null
    }
    role: OrgRole
    created_at: string
  }>
  recentDocuments: Array<{
    id: string
    original_name: string
    status: DocumentStatus
    created_at: string
  }>
}

export interface DocumentListItem {
  [key: string]: unknown
  id: string
  original_name: string
  mime_type: string
  file_size: number
  status: DocumentStatus
  error_message: string | null
  created_at: string
  organization: {
    id: string
    name: string
    slug: string
  }
  uploader: {
    id: string
    email: string | null
  }
}

export interface TimeSeriesPoint {
  date: string
  value: number
}

export interface AnalyticsData {
  userGrowth: TimeSeriesPoint[]
  memoryGrowth: TimeSeriesPoint[]
  searchActivity: TimeSeriesPoint[]
  documentUploads: TimeSeriesPoint[]
  tokenUsage: TimeSeriesPoint[]
  topUsers: Array<{
    id: string
    email: string | null
    memoryCount: number
    searchCount: number
  }>
}

export interface AuditLogItem {
  [key: string]: unknown
  id: string
  user_id: string
  event_type: string
  event_category: string
  action: string
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  user: {
    email: string | null
  }
}

export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

export interface StorageByOrganization {
  id: string
  name: string
  size: number
  documentCount: number
  avgFileSize: number
}

export interface StorageByFileType {
  mimeType: string
  size: number
  count: number
  percentage: number
}

export interface LargestFile {
  id: string
  name: string
  size: number
  mimeType: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  createdAt: string
}

export interface StorageAnalytics {
  totalStorage: number
  storageByOrganization: StorageByOrganization[]
  storageByFileType: StorageByFileType[]
  largestFiles: LargestFile[]
  storageTrends: TimeSeriesPoint[]
  projectedStorage: {
    current: number
    thirtyDay: number
    ninetyDay: number
    dailyGrowthRate: number
  }
}
