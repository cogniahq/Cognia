import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Brain, FileText, Search, Trash2, Users } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import {
  deleteOrganization,
  getOrganizationDetails,
  listOrganizations,
  updateOrganizationPlan,
} from '@/services/api'
import type {
  OrgDetails,
  OrgListItem,
  PaginatedResult,
} from '@/types/admin.types'

const PLANS = ['free', 'pro', 'enterprise']

function getPlanBadgeVariant(plan: string) {
  switch (plan) {
    case 'enterprise':
      return 'info'
    case 'pro':
      return 'success'
    default:
      return 'default'
  }
}

export function OrganizationsPage() {
  const [orgs, setOrgs] = useState<PaginatedResult<OrgListItem> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [selectedOrg, setSelectedOrg] = useState<OrgDetails | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const loadOrgs = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await listOrganizations(
        page,
        20,
        search || undefined,
        planFilter || undefined
      )
      setOrgs(data)
    } catch (err) {
      console.error('Failed to load organizations', err)
    } finally {
      setIsLoading(false)
    }
  }, [page, search, planFilter])

  useEffect(() => {
    loadOrgs()
  }, [loadOrgs])

  async function handleRowClick(org: OrgListItem) {
    try {
      const details = await getOrganizationDetails(org.id)
      setSelectedOrg(details)
      setDrawerOpen(true)
    } catch (err) {
      console.error('Failed to load organization details', err)
    }
  }

  async function handlePlanChange(orgId: string, plan: string) {
    if (!confirm(`Change organization plan to ${plan}?`)) return
    try {
      await updateOrganizationPlan(orgId, plan)
      loadOrgs()
      if (selectedOrg?.id === orgId) {
        const details = await getOrganizationDetails(orgId)
        setSelectedOrg(details)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update plan')
    }
  }

  async function handleDelete(orgId: string) {
    if (
      !confirm(
        'Delete this organization? This action cannot be undone and will remove all members and documents.'
      )
    )
      return
    try {
      await deleteOrganization(orgId)
      setDrawerOpen(false)
      setSelectedOrg(null)
      loadOrgs()
    } catch (err) {
      alert(
        err instanceof Error ? err.message : 'Failed to delete organization'
      )
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (org: OrgListItem) => (
        <div>
          <div className="text-sm text-gray-900">{org.name}</div>
          <div className="text-xs text-gray-500 font-mono">{org.slug}</div>
        </div>
      ),
    },
    {
      key: 'plan',
      label: 'Plan',
      width: '100px',
      render: (org: OrgListItem) => (
        <Badge variant={getPlanBadgeVariant(org.plan)}>{org.plan}</Badge>
      ),
    },
    {
      key: 'industry',
      label: 'Industry',
      width: '150px',
      render: (org: OrgListItem) => (
        <span className="text-xs text-gray-500">{org.industry || '-'}</span>
      ),
    },
    {
      key: 'members',
      label: 'Members',
      width: '100px',
      render: (org: OrgListItem) => (
        <span className="font-mono text-xs">{org._count.members}</span>
      ),
    },
    {
      key: 'documents',
      label: 'Docs',
      width: '80px',
      render: (org: OrgListItem) => (
        <span className="font-mono text-xs">{org._count.documents}</span>
      ),
    },
    {
      key: 'memories',
      label: 'Memories',
      width: '100px',
      render: (org: OrgListItem) => (
        <span className="font-mono text-xs">{org._count.memories}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      width: '120px',
      render: (org: OrgListItem) => (
        <span className="text-xs text-gray-500">
          {format(new Date(org.created_at), 'yyyy-MM-dd')}
        </span>
      ),
    },
  ]

  return (
    <>
      <Header title="Organizations" subtitle="Manage all workspaces" />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by name or slug..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-900"
            />
          </div>
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-900 bg-white"
          >
            <option value="">All Plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={orgs?.data || []}
          keyField="id"
          onRowClick={handleRowClick}
          isLoading={isLoading}
          emptyMessage="No organizations found"
          pagination={
            orgs
              ? {
                  page: orgs.page,
                  totalPages: orgs.totalPages,
                  total: orgs.total,
                  onPageChange: setPage,
                }
              : undefined
          }
        />
      </div>

      {/* Org Details Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedOrg(null)
        }}
        title="Organization Details"
        subtitle={selectedOrg?.slug || ''}
        width="w-[520px]"
      >
        {selectedOrg && (
          <div className="space-y-6">
            {/* Basic Info */}
            <section>
              <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
                [INFO]
              </div>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">ID</span>
                  <span className="text-xs font-mono">{selectedOrg.id}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Name</span>
                  <span className="text-xs">{selectedOrg.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Slug</span>
                  <span className="text-xs font-mono">{selectedOrg.slug}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Industry</span>
                  <span className="text-xs">{selectedOrg.industry || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Team Size</span>
                  <span className="text-xs">
                    {selectedOrg.team_size || '-'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Data Residency</span>
                  <span className="text-xs">{selectedOrg.data_residency}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Require 2FA</span>
                  <span className="text-xs">
                    {selectedOrg.require_2fa ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Created</span>
                  <span className="text-xs">
                    {format(
                      new Date(selectedOrg.created_at),
                      'yyyy-MM-dd HH:mm'
                    )}
                  </span>
                </div>
              </div>
            </section>

            {/* Plan */}
            <section>
              <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
                [PLAN]
              </div>
              <div className="flex gap-2">
                {PLANS.map((plan) => (
                  <button
                    key={plan}
                    onClick={() => handlePlanChange(selectedOrg.id, plan)}
                    className={`flex-1 px-3 py-2 border text-xs font-mono uppercase transition-colors ${
                      selectedOrg.plan === plan
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {plan}
                  </button>
                ))}
              </div>
            </section>

            {/* Stats */}
            <section>
              <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
                [STATS]
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-gray-50 border border-gray-200 text-center">
                  <Users className="w-4 h-4 mx-auto mb-1 text-gray-400" />
                  <div className="text-lg font-mono text-gray-900">
                    {selectedOrg._count.members}
                  </div>
                  <div className="text-xs text-gray-500">Members</div>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 text-center">
                  <FileText className="w-4 h-4 mx-auto mb-1 text-gray-400" />
                  <div className="text-lg font-mono text-gray-900">
                    {selectedOrg._count.documents}
                  </div>
                  <div className="text-xs text-gray-500">Documents</div>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 text-center">
                  <Brain className="w-4 h-4 mx-auto mb-1 text-gray-400" />
                  <div className="text-lg font-mono text-gray-900">
                    {selectedOrg._count.memories}
                  </div>
                  <div className="text-xs text-gray-500">Memories</div>
                </div>
              </div>
            </section>

            {/* Members */}
            {selectedOrg.members.length > 0 && (
              <section>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
                  [MEMBERS]
                </div>
                <div className="space-y-2">
                  {selectedOrg.members.map((m) => (
                    <div
                      key={m.user.id}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200"
                    >
                      <div>
                        <div className="text-sm text-gray-900">
                          {m.user.email || 'No email'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Joined {format(new Date(m.created_at), 'yyyy-MM-dd')}
                        </div>
                      </div>
                      <Badge
                        variant={
                          m.role === 'ADMIN'
                            ? 'info'
                            : m.role === 'EDITOR'
                              ? 'success'
                              : 'default'
                        }
                      >
                        {m.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Documents */}
            {selectedOrg.recentDocuments.length > 0 && (
              <section>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
                  [RECENT DOCUMENTS]
                </div>
                <div className="space-y-2">
                  {selectedOrg.recentDocuments.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200"
                    >
                      <div>
                        <div className="text-sm text-gray-900 truncate max-w-[280px]">
                          {d.original_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(d.created_at), 'yyyy-MM-dd HH:mm')}
                        </div>
                      </div>
                      <Badge
                        variant={
                          d.status === 'COMPLETED'
                            ? 'success'
                            : d.status === 'FAILED'
                              ? 'error'
                              : d.status === 'PROCESSING'
                                ? 'warning'
                                : 'default'
                        }
                      >
                        {d.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Danger Zone */}
            <section>
              <div className="text-xs font-mono text-red-500 uppercase tracking-wider mb-3">
                [DANGER ZONE]
              </div>
              <button
                onClick={() => handleDelete(selectedOrg.id)}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 border border-red-300 text-red-600 text-xs font-mono hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Organization
              </button>
            </section>
          </div>
        )}
      </Drawer>
    </>
  )
}
