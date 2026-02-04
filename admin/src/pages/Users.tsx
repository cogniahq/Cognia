import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Search, Shield, Trash2, User } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import {
  deleteUser,
  getUserDetails,
  listUsers,
  updateUserRole,
} from '@/services/api'
import type {
  PaginatedResult,
  UserDetails,
  UserListItem,
  UserRole,
} from '@/types/admin.types'

export function UsersPage() {
  const [users, setUsers] = useState<PaginatedResult<UserListItem> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await listUsers(
        page,
        20,
        search || undefined,
        roleFilter || undefined
      )
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users', err)
    } finally {
      setIsLoading(false)
    }
  }, [page, search, roleFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function handleRowClick(user: UserListItem) {
    try {
      const details = await getUserDetails(user.id)
      setSelectedUser(details)
      setDrawerOpen(true)
    } catch (err) {
      console.error('Failed to load user details', err)
    }
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    if (!confirm(`Change user role to ${role}?`)) return
    try {
      await updateUserRole(userId, role)
      loadUsers()
      if (selectedUser?.id === userId) {
        const details = await getUserDetails(userId)
        setSelectedUser(details)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm('Delete this user? This action cannot be undone.')) return
    try {
      await deleteUser(userId)
      setDrawerOpen(false)
      setSelectedUser(null)
      loadUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const columns = [
    {
      key: 'email',
      label: 'Email',
      render: (user: UserListItem) => (
        <span className="font-mono text-xs">{user.email || '-'}</span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      width: '100px',
      render: (user: UserListItem) => (
        <Badge variant={user.role === 'ADMIN' ? 'info' : 'default'}>
          {user.role}
        </Badge>
      ),
    },
    {
      key: 'account_type',
      label: 'Type',
      width: '120px',
      render: (user: UserListItem) => (
        <span className="text-xs text-gray-500">{user.account_type}</span>
      ),
    },
    {
      key: 'memories',
      label: 'Memories',
      width: '100px',
      render: (user: UserListItem) => (
        <span className="font-mono text-xs">{user._count.memories}</span>
      ),
    },
    {
      key: 'orgs',
      label: 'Orgs',
      width: '80px',
      render: (user: UserListItem) => (
        <span className="font-mono text-xs">
          {user._count.organization_memberships}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      width: '120px',
      render: (user: UserListItem) => (
        <span className="text-xs text-gray-500">
          {format(new Date(user.created_at), 'yyyy-MM-dd')}
        </span>
      ),
    },
  ]

  return (
    <>
      <Header title="Users" subtitle="Manage all platform users" />
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
              placeholder="Search by email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-900"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as UserRole | '')
              setPage(1)
            }}
            className="px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gray-900 bg-white"
          >
            <option value="">All Roles</option>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={users?.data || []}
          keyField="id"
          onRowClick={handleRowClick}
          isLoading={isLoading}
          emptyMessage="No users found"
          pagination={
            users
              ? {
                  page: users.page,
                  totalPages: users.totalPages,
                  total: users.total,
                  onPageChange: setPage,
                }
              : undefined
          }
        />
      </div>

      {/* User Details Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedUser(null)
        }}
        title="User Details"
        subtitle={selectedUser?.email || ''}
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* Basic Info */}
            <section>
              <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
                [INFO]
              </div>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">ID</span>
                  <span className="text-xs font-mono">{selectedUser.id}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Email</span>
                  <span className="text-xs">{selectedUser.email || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Account Type</span>
                  <span className="text-xs">{selectedUser.account_type}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Created</span>
                  <span className="text-xs">
                    {format(
                      new Date(selectedUser.created_at),
                      'yyyy-MM-dd HH:mm'
                    )}
                  </span>
                </div>
              </div>
            </section>

            {/* Role */}
            <section>
              <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
                [ROLE]
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRoleChange(selectedUser.id, 'USER')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border text-xs font-mono transition-colors ${
                    selectedUser.role === 'USER'
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <User className="w-4 h-4" />
                  User
                </button>
                <button
                  onClick={() => handleRoleChange(selectedUser.id, 'ADMIN')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border text-xs font-mono transition-colors ${
                    selectedUser.role === 'ADMIN'
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </button>
              </div>
            </section>

            {/* Stats */}
            <section>
              <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
                [STATS]
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-gray-50 border border-gray-200 text-center">
                  <div className="text-lg font-mono text-gray-900">
                    {selectedUser._count.memories}
                  </div>
                  <div className="text-xs text-gray-500">Memories</div>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 text-center">
                  <div className="text-lg font-mono text-gray-900">
                    {selectedUser._count.organization_memberships}
                  </div>
                  <div className="text-xs text-gray-500">Orgs</div>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 text-center">
                  <div className="text-lg font-mono text-gray-900">
                    {selectedUser._count.uploaded_documents}
                  </div>
                  <div className="text-xs text-gray-500">Documents</div>
                </div>
              </div>
            </section>

            {/* Organizations */}
            {selectedUser.organization_memberships.length > 0 && (
              <section>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
                  [ORGANIZATIONS]
                </div>
                <div className="space-y-2">
                  {selectedUser.organization_memberships.map((m) => (
                    <div
                      key={m.organization.id}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200"
                    >
                      <div>
                        <div className="text-sm text-gray-900">
                          {m.organization.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {m.organization.slug}
                        </div>
                      </div>
                      <Badge>{m.role}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Memories */}
            {selectedUser.recentMemories.length > 0 && (
              <section>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
                  [RECENT MEMORIES]
                </div>
                <div className="space-y-2">
                  {selectedUser.recentMemories.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 bg-gray-50 border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="default">{m.memory_type}</Badge>
                        <span className="text-xs text-gray-400">
                          {format(new Date(m.created_at), 'MM-dd HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {m.content}
                      </p>
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
                onClick={() => handleDelete(selectedUser.id)}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 border border-red-300 text-red-600 text-xs font-mono hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete User
              </button>
            </section>
          </div>
        )}
      </Drawer>
    </>
  )
}
