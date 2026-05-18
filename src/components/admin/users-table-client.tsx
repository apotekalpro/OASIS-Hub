'use client'

import { useState, useMemo } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth/permissions'
import { formatDate } from '@/lib/utils'
import { UserManagementClient } from '@/components/admin/user-management-client'
import type { UserRole } from '@/types/database'

type User = {
  id: string
  full_name: string
  email: string
  contact_email: string | null
  role: UserRole
  is_active: boolean
  must_change_password: boolean
  employee_id: string | null
  avatar_url: string | null
  dept_id: string | null
  outlet_id: string | null
  created_at: string
  job_title: string | null
  phone: string | null
  last_login_at: string | null
  chief_departments: Array<{ dept_id: string }>
}

type Department = { id: string; name: string; org_id: string }
type Outlet = { id: string; name: string; code: string | null }
type Role = { slug: string; label: string; level: number; is_system: boolean }

interface UsersTableClientProps {
  users: User[]
  departments: Department[]
  outlets: Outlet[]
  rolesData: Role[]
  orgId: string | null
}

export function UsersTableClient({ users, departments, outlets, rolesData, orgId }: UsersTableClientProps) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [deptFilter, setDeptFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return users.filter(u => {
      if (roleFilter && u.role !== roleFilter) return false
      if (statusFilter === 'active' && !u.is_active) return false
      if (statusFilter === 'inactive' && u.is_active) return false
      if (deptFilter) {
        if (u.role === 'chief') {
          if (!u.chief_departments.some(cd => cd.dept_id === deptFilter)) return false
        } else {
          if (u.dept_id !== deptFilter) return false
        }
      }
      if (q) {
        const match =
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.employee_id ?? '').toLowerCase().includes(q) ||
          (u.contact_email ?? '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [users, search, roleFilter, deptFilter, statusFilter])

  const hasFilters = search || roleFilter || deptFilter || statusFilter

  function clearFilters() {
    setSearch('')
    setRoleFilter('')
    setDeptFilter('')
    setStatusFilter('')
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base">
              All Users ({filtered.length}{filtered.length !== users.length ? ` of ${users.length}` : ''})
            </CardTitle>
            <CardDescription>
              Active users in your organization. Default password:{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Alpro@123</code>
            </CardDescription>
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mt-1"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-2 pt-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search name, email, employee ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All roles</option>
            {rolesData.map(r => (
              <option key={r.slug} value={r.slug}>{r.label}</option>
            ))}
          </select>

          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Department</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Joined</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Last Login</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm">
                    No users match your filters.
                  </td>
                </tr>
              ) : filtered.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.full_name} avatarUrl={user.avatar_url} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                        {user.contact_email && (
                          <p className="text-xs text-indigo-500">
                            {user.contact_email} <span className="text-gray-300">(contact)</span>
                          </p>
                        )}
                        {user.employee_id && (
                          <p className="text-xs text-gray-400">ID: {user.employee_id}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role as UserRole] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[user.role as UserRole] ?? user.role}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-500 text-sm">
                    {user.role === 'chief' && user.chief_departments?.length
                      ? user.chief_departments
                          .map(cd => departments.find(d => d.id === cd.dept_id)?.name)
                          .filter(Boolean)
                          .join(', ')
                      : user.role === 'outlet' && user.outlet_id
                        ? <span className="text-orange-700">{outlets.find(o => o.id === user.outlet_id)?.name ?? '—'}</span>
                        : departments.find(d => d.id === user.dept_id)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <Badge variant={user.is_active ? 'success' : 'destructive'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {user.must_change_password && (
                        <Badge variant="warning" className="text-xs">Pending PW</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-500">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-4 text-gray-500">
                    {user.last_login_at ? formatDate(user.last_login_at) : <span className="text-gray-300">Never</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <UserManagementClient
                      userId={user.id}
                      user={user}
                      departments={departments}
                      outlets={outlets}
                      orgId={orgId}
                      roles={rolesData}
                      initialChiefDeptIds={user.chief_departments?.map(cd => cd.dept_id) ?? []}
                      mode="actions"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
