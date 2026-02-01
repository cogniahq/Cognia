import axios from 'axios'
import type {
  DashboardStats,
  PaginatedResult,
  UserListItem,
  UserDetails,
  OrgListItem,
  OrgDetails,
  DocumentListItem,
  AnalyticsData,
  AuditLogItem,
  UserRole,
  DocumentStatus,
  AuthUser,
} from '@/types/admin.types'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const response = await api.post('/auth/login', { email, password })
  const { token, user } = response.data.data

  // Verify admin role
  if (user.role !== 'ADMIN') {
    throw new Error('Admin access required')
  }

  return { token, user }
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await api.get('/auth/me')
  return response.data.data
}

// Dashboard
export async function getDashboard(): Promise<DashboardStats> {
  const response = await api.get('/admin/dashboard')
  return response.data.data
}

// Users
export async function listUsers(
  page: number = 1,
  limit: number = 20,
  search?: string,
  role?: UserRole
): Promise<PaginatedResult<UserListItem>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (search) params.set('search', search)
  if (role) params.set('role', role)

  const response = await api.get(`/admin/users?${params}`)
  return response.data.data
}

export async function getUserDetails(userId: string): Promise<UserDetails> {
  const response = await api.get(`/admin/users/${userId}`)
  return response.data.data
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  await api.put(`/admin/users/${userId}/role`, { role })
}

export async function deleteUser(userId: string): Promise<void> {
  await api.delete(`/admin/users/${userId}`)
}

// Organizations
export async function listOrganizations(
  page: number = 1,
  limit: number = 20,
  search?: string,
  plan?: string
): Promise<PaginatedResult<OrgListItem>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (search) params.set('search', search)
  if (plan) params.set('plan', plan)

  const response = await api.get(`/admin/organizations?${params}`)
  return response.data.data
}

export async function getOrganizationDetails(orgId: string): Promise<OrgDetails> {
  const response = await api.get(`/admin/organizations/${orgId}`)
  return response.data.data
}

export async function updateOrganizationPlan(orgId: string, plan: string): Promise<void> {
  await api.put(`/admin/organizations/${orgId}/plan`, { plan })
}

export async function deleteOrganization(orgId: string): Promise<void> {
  await api.delete(`/admin/organizations/${orgId}`)
}

// Documents
export async function listDocuments(
  page: number = 1,
  limit: number = 20,
  status?: DocumentStatus,
  orgId?: string
): Promise<PaginatedResult<DocumentListItem>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (status) params.set('status', status)
  if (orgId) params.set('orgId', orgId)

  const response = await api.get(`/admin/documents?${params}`)
  return response.data.data
}

export async function reprocessDocument(documentId: string): Promise<void> {
  await api.post(`/admin/documents/${documentId}/reprocess`)
}

// Analytics
export async function getAnalytics(days: number = 30): Promise<AnalyticsData> {
  const response = await api.get(`/admin/analytics?days=${days}`)
  return response.data.data
}

// Audit Logs
export async function getAuditLogs(
  page: number = 1,
  limit: number = 50,
  userId?: string,
  eventType?: string
): Promise<PaginatedResult<AuditLogItem>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (userId) params.set('userId', userId)
  if (eventType) params.set('eventType', eventType)

  const response = await api.get(`/admin/audit-logs?${params}`)
  return response.data.data
}
