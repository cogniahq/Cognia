import { prisma } from '../../lib/prisma.lib'
import { getRedisClient } from '../../lib/redis.lib'
import { qdrantClient, COLLECTION_NAME } from '../../lib/qdrant.lib'
import { storageService } from '../storage/storage.service'
import { logger } from '../../utils/core/logger.util'
import { UserRole, OrgRole, DocumentStatus } from '@prisma/client'

// Types
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

export interface UserListItem {
  id: string
  email: string | null
  role: UserRole
  account_type: string
  created_at: Date
  updated_at: Date
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
    created_at: Date
  }>
}

export interface OrgListItem {
  id: string
  name: string
  slug: string
  plan: string
  industry: string | null
  team_size: string | null
  created_at: Date
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
    created_at: Date
  }>
  recentDocuments: Array<{
    id: string
    original_name: string
    status: DocumentStatus
    created_at: Date
  }>
}

export interface DocumentListItem {
  id: string
  original_name: string
  mime_type: string
  file_size: number
  status: DocumentStatus
  error_message: string | null
  created_at: Date
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
  id: string
  user_id: string
  event_type: string
  event_category: string
  action: string
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: Date
  user: {
    email: string | null
  }
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
  createdAt: Date
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

class AdminService {
  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Parallel queries
    const [
      totalUsers,
      adminUsers,
      activeUsers,
      newUsersToday,
      newUsersWeek,
      totalOrgs,
      orgsByPlan,
      newOrgsWeek,
      totalMemories,
      memoriesGroupedByType,
      memoriesGroupedBySource,
      newMemoriesToday,
      newMemoriesWeek,
      totalDocuments,
      documentsByStatus,
      documentsTotalSize,
      tokenUsageTotal,
      tokenUsageToday,
      searches24h,
      memoriesCreated24h,
      documentsUploaded24h,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({
        where: { memories: { some: { created_at: { gte: thirtyDaysAgo } } } },
      }),
      prisma.user.count({ where: { created_at: { gte: today } } }),
      prisma.user.count({ where: { created_at: { gte: weekAgo } } }),
      prisma.organization.count(),
      prisma.organization.groupBy({ by: ['plan'], _count: true }),
      prisma.organization.count({ where: { created_at: { gte: weekAgo } } }),
      prisma.memory.count(),
      prisma.memory.groupBy({ by: ['memory_type'], _count: true }),
      prisma.memory.groupBy({ by: ['source'], _count: true }),
      prisma.memory.count({ where: { created_at: { gte: today } } }),
      prisma.memory.count({ where: { created_at: { gte: weekAgo } } }),
      prisma.document.count(),
      prisma.document.groupBy({ by: ['status'], _count: true }),
      prisma.document.aggregate({ _sum: { file_size: true } }),
      prisma.tokenUsage.aggregate({ _sum: { input_tokens: true, output_tokens: true } }),
      prisma.tokenUsage.aggregate({
        where: { created_at: { gte: today } },
        _sum: { input_tokens: true, output_tokens: true },
      }),
      prisma.queryEvent.count({ where: { created_at: { gte: dayAgo } } }),
      prisma.memory.count({ where: { created_at: { gte: dayAgo } } }),
      prisma.document.count({ where: { created_at: { gte: dayAgo } } }),
    ])

    // System health checks
    let redisConnected = false
    let redisMemory: string | undefined
    let qdrantConnected = false
    let qdrantPoints = 0

    try {
      const redis = getRedisClient()
      await redis.ping()
      redisConnected = true
      const info = await redis.info('memory')
      const match = info.match(/used_memory_human:(.+)/)
      if (match) redisMemory = match[1].trim()
    } catch (e) {
      logger.warn('[admin-service] Redis health check failed', { error: String(e) })
    }

    try {
      const collectionInfo = await qdrantClient.getCollection(COLLECTION_NAME)
      qdrantConnected = true
      qdrantPoints = collectionInfo.points_count || 0
    } catch (e) {
      logger.warn('[admin-service] Qdrant health check failed', { error: String(e) })
    }

    // Build stats
    const byPlan: Record<string, number> = {}
    orgsByPlan.forEach(g => { byPlan[g.plan] = g._count })

    const byType: Record<string, number> = {}
    memoriesGroupedByType.forEach(g => { byType[g.memory_type || 'unknown'] = g._count })

    const bySource: Record<string, number> = {}
    memoriesGroupedBySource.forEach(g => { bySource[g.source] = g._count })

    const docByStatus: Record<string, number> = {}
    documentsByStatus.forEach(g => { docByStatus[g.status] = g._count })

    const totalInput = Number(tokenUsageTotal._sum.input_tokens || 0)
    const totalOutput = Number(tokenUsageTotal._sum.output_tokens || 0)
    const inputCost = (totalInput / 1_000_000) * 0.5
    const outputCost = (totalOutput / 1_000_000) * 1.5

    return {
      users: {
        total: totalUsers,
        admins: adminUsers,
        active30d: activeUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersWeek,
      },
      organizations: {
        total: totalOrgs,
        byPlan,
        newThisWeek: newOrgsWeek,
      },
      memories: {
        total: totalMemories,
        newToday: newMemoriesToday,
        newThisWeek: newMemoriesWeek,
        byType,
        bySource,
      },
      documents: {
        total: totalDocuments,
        byStatus: docByStatus,
        totalSize: documentsTotalSize._sum.file_size || 0,
      },
      system: {
        database: true, // If we got here, DB is working
        redis: redisConnected,
        redisMemory,
        qdrant: qdrantConnected,
        qdrantPoints,
      },
      tokenUsage: {
        totalInput,
        totalOutput,
        estimatedCost: inputCost + outputCost,
        todayInput: Number(tokenUsageToday._sum.input_tokens || 0),
        todayOutput: Number(tokenUsageToday._sum.output_tokens || 0),
      },
      activity: {
        searches24h,
        memoriesCreated24h,
        documentsUploaded24h,
      },
    }
  }

  /**
   * List all users with pagination
   */
  async listUsers(
    page: number = 1,
    limit: number = 20,
    search?: string,
    role?: UserRole
  ): Promise<PaginatedResult<UserListItem>> {
    const where: Parameters<typeof prisma.user.findMany>[0]['where'] = {}

    if (search) {
      where.email = { contains: search, mode: 'insensitive' }
    }
    if (role) {
      where.role = role
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          account_type: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              memories: true,
              organization_memberships: true,
              uploaded_documents: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get user details
   */
  async getUserDetails(userId: string): Promise<UserDetails | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        account_type: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            memories: true,
            organization_memberships: true,
            uploaded_documents: true,
          },
        },
        profile: {
          select: {
            static_profile_text: true,
            dynamic_profile_text: true,
          },
        },
        organization_memberships: {
          select: {
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        memories: {
          select: {
            id: true,
            content: true,
            memory_type: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    })

    if (!user) return null

    return {
      ...user,
      recentMemories: user.memories,
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    })
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    await prisma.user.delete({
      where: { id: userId },
    })
  }

  /**
   * List all organizations
   */
  async listOrganizations(
    page: number = 1,
    limit: number = 20,
    search?: string,
    plan?: string
  ): Promise<PaginatedResult<OrgListItem>> {
    const where: Parameters<typeof prisma.organization.findMany>[0]['where'] = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (plan) {
      where.plan = plan
    }

    const [data, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          industry: true,
          team_size: true,
          created_at: true,
          _count: {
            select: {
              members: true,
              documents: true,
              memories: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ])

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get organization details
   */
  async getOrganizationDetails(orgId: string): Promise<OrgDetails | null> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        plan: true,
        industry: true,
        team_size: true,
        data_residency: true,
        require_2fa: true,
        created_at: true,
        _count: {
          select: {
            members: true,
            documents: true,
            memories: true,
          },
        },
        members: {
          select: {
            role: true,
            created_at: true,
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
        },
        documents: {
          select: {
            id: true,
            original_name: true,
            status: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    })

    if (!org) return null

    return {
      ...org,
      recentDocuments: org.documents,
    }
  }

  /**
   * Update organization plan
   */
  async updateOrganizationPlan(orgId: string, plan: string): Promise<void> {
    await prisma.organization.update({
      where: { id: orgId },
      data: { plan },
    })
  }

  /**
   * Delete organization
   */
  async deleteOrganization(orgId: string): Promise<void> {
    await prisma.organization.delete({
      where: { id: orgId },
    })
  }

  /**
   * List all documents
   */
  async listDocuments(
    page: number = 1,
    limit: number = 20,
    status?: DocumentStatus,
    orgId?: string
  ): Promise<PaginatedResult<DocumentListItem>> {
    const where: Parameters<typeof prisma.document.findMany>[0]['where'] = {}

    if (status) where.status = status
    if (orgId) where.organization_id = orgId

    const [data, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          original_name: true,
          mime_type: true,
          file_size: true,
          status: true,
          error_message: true,
          created_at: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          uploader: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.document.count({ where }),
    ])

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Reprocess a failed document
   */
  async reprocessDocument(documentId: string): Promise<void> {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'PENDING',
        error_message: null,
      },
    })
    // TODO: Trigger reprocessing job in queue
  }

  /**
   * Get analytics time series data
   */
  async getAnalytics(days: number = 30): Promise<AnalyticsData> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    // Get daily counts using raw queries for efficiency
    const userGrowth = await this.getTimeSeriesData('users', startDate, days)
    const memoryGrowth = await this.getTimeSeriesData('memories', startDate, days)
    const searchActivity = await this.getTimeSeriesData('query_events', startDate, days)
    const documentUploads = await this.getTimeSeriesData('documents', startDate, days)

    // Token usage time series
    const tokenUsageRaw = await prisma.tokenUsage.groupBy({
      by: ['created_at'],
      where: { created_at: { gte: startDate } },
      _sum: { input_tokens: true, output_tokens: true },
    })

    const tokenUsageByDate = new Map<string, number>()
    tokenUsageRaw.forEach(t => {
      const date = t.created_at.toISOString().split('T')[0]
      const current = tokenUsageByDate.get(date) || 0
      tokenUsageByDate.set(date, current + (t._sum.input_tokens || 0) + (t._sum.output_tokens || 0))
    })

    const tokenUsage: TimeSeriesPoint[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      tokenUsage.push({ date: dateStr, value: tokenUsageByDate.get(dateStr) || 0 })
    }

    // Top users
    const topUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        _count: {
          select: { memories: true },
        },
      },
      orderBy: { memories: { _count: 'desc' } },
      take: 10,
    })

    // Get search counts for top users
    const topUsersWithSearch = await Promise.all(
      topUsers.map(async u => {
        const searchCount = await prisma.queryEvent.count({ where: { user_id: u.id } })
        return {
          id: u.id,
          email: u.email,
          memoryCount: u._count.memories,
          searchCount,
        }
      })
    )

    return {
      userGrowth,
      memoryGrowth,
      searchActivity,
      documentUploads,
      tokenUsage,
      topUsers: topUsersWithSearch,
    }
  }

  private async getTimeSeriesData(
    table: 'users' | 'memories' | 'query_events' | 'documents',
    startDate: Date,
    days: number
  ): Promise<TimeSeriesPoint[]> {
    // Get counts by date using Prisma
    let records: Array<{ created_at: Date }>

    switch (table) {
      case 'users':
        records = await prisma.user.findMany({
          where: { created_at: { gte: startDate } },
          select: { created_at: true },
        })
        break
      case 'memories':
        records = await prisma.memory.findMany({
          where: { created_at: { gte: startDate } },
          select: { created_at: true },
        })
        break
      case 'query_events':
        records = await prisma.queryEvent.findMany({
          where: { created_at: { gte: startDate } },
          select: { created_at: true },
        })
        break
      case 'documents':
        records = await prisma.document.findMany({
          where: { created_at: { gte: startDate } },
          select: { created_at: true },
        })
        break
    }

    // Group by date
    const countByDate = new Map<string, number>()
    records.forEach(r => {
      const dateStr = r.created_at.toISOString().split('T')[0]
      countByDate.set(dateStr, (countByDate.get(dateStr) || 0) + 1)
    })

    // Build full date range with zeros
    const timeSeries: TimeSeriesPoint[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      timeSeries.push({ date: dateStr, value: countByDate.get(dateStr) || 0 })
    }

    return timeSeries
  }

  /**
   * Get storage analytics
   */
  async getStorageAnalytics(days: number = 30): Promise<StorageAnalytics> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    // Get total storage
    const totalStorageResult = await prisma.document.aggregate({
      _sum: { file_size: true },
    })
    const totalStorage = totalStorageResult._sum.file_size || 0

    // Get storage by organization (top 10)
    const orgStorageRaw = await prisma.document.groupBy({
      by: ['organization_id'],
      _sum: { file_size: true },
      _count: true,
      orderBy: { _sum: { file_size: 'desc' } },
      take: 10,
    })

    const orgIds = orgStorageRaw.map(o => o.organization_id)
    const orgs = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    })
    const orgMap = new Map(orgs.map(o => [o.id, o.name]))

    const storageByOrganization: StorageByOrganization[] = orgStorageRaw.map(o => ({
      id: o.organization_id,
      name: orgMap.get(o.organization_id) || 'Unknown',
      size: o._sum.file_size || 0,
      documentCount: o._count,
      avgFileSize: o._count > 0 ? Math.round((o._sum.file_size || 0) / o._count) : 0,
    }))

    // Get storage by file type
    const fileTypeStorageRaw = await prisma.document.groupBy({
      by: ['mime_type'],
      _sum: { file_size: true },
      _count: true,
      orderBy: { _sum: { file_size: 'desc' } },
    })

    const storageByFileType: StorageByFileType[] = fileTypeStorageRaw.map(f => ({
      mimeType: f.mime_type,
      size: f._sum.file_size || 0,
      count: f._count,
      percentage: totalStorage > 0 ? ((f._sum.file_size || 0) / totalStorage) * 100 : 0,
    }))

    // Get largest files (top 10)
    const largestFilesRaw = await prisma.document.findMany({
      orderBy: { file_size: 'desc' },
      take: 10,
      select: {
        id: true,
        original_name: true,
        file_size: true,
        mime_type: true,
        created_at: true,
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    const largestFiles: LargestFile[] = largestFilesRaw.map(f => ({
      id: f.id,
      name: f.original_name,
      size: f.file_size,
      mimeType: f.mime_type,
      organizationId: f.organization.id,
      organizationName: f.organization.name,
      organizationSlug: f.organization.slug,
      createdAt: f.created_at,
    }))

    // Get storage trends (cumulative daily totals)
    const documents = await prisma.document.findMany({
      where: { created_at: { gte: startDate } },
      select: { created_at: true, file_size: true },
      orderBy: { created_at: 'asc' },
    })

    // Get storage before the start date for cumulative calculation
    const storageBeforeStart = await prisma.document.aggregate({
      where: { created_at: { lt: startDate } },
      _sum: { file_size: true },
    })
    let cumulativeStorage = storageBeforeStart._sum.file_size || 0

    // Build daily storage map
    const dailyStorage = new Map<string, number>()
    documents.forEach(d => {
      const dateStr = d.created_at.toISOString().split('T')[0]
      dailyStorage.set(dateStr, (dailyStorage.get(dateStr) || 0) + d.file_size)
    })

    // Build time series with cumulative totals
    const storageTrends: TimeSeriesPoint[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      cumulativeStorage += dailyStorage.get(dateStr) || 0
      storageTrends.push({ date: dateStr, value: cumulativeStorage })
    }

    // Calculate projections
    const dailyGrowthRate = storageTrends.length >= 2
      ? (storageTrends[storageTrends.length - 1].value - storageTrends[0].value) / days
      : 0

    const projectedStorage = {
      current: totalStorage,
      thirtyDay: Math.round(totalStorage + dailyGrowthRate * 30),
      ninetyDay: Math.round(totalStorage + dailyGrowthRate * 90),
      dailyGrowthRate: Math.round(dailyGrowthRate),
    }

    return {
      totalStorage,
      storageByOrganization,
      storageByFileType,
      largestFiles,
      storageTrends,
      projectedStorage,
    }
  }

  /**
   * Get download URL for any document (admin access)
   */
  async getDocumentDownloadUrl(documentId: string): Promise<{ url: string; filename: string }> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { storage_path: true, original_name: true },
    })

    if (!document) {
      throw new Error('Document not found')
    }

    const url = await storageService.getSignedUrl(document.storage_path, 3600) // 1 hour expiry
    return { url, filename: document.original_name }
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(
    page: number = 1,
    limit: number = 50,
    userId?: string,
    eventType?: string
  ): Promise<PaginatedResult<AuditLogItem>> {
    const where: Parameters<typeof prisma.auditLog.findMany>[0]['where'] = {}

    if (userId) where.user_id = userId
    if (eventType) where.event_type = eventType

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          user_id: true,
          event_type: true,
          event_category: true,
          action: true,
          metadata: true,
          ip_address: true,
          created_at: true,
          user: {
            select: { email: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return {
      data: data.map(d => ({ ...d, metadata: d.metadata as Record<string, unknown> | null })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }
}

export const adminService = new AdminService()
