'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Phone, Mail, Building2, SlidersHorizontal, GitBranch } from 'lucide-react'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth/permissions'
import { formatRelativeTime } from '@/lib/utils'
import * as Popover from '@radix-ui/react-popover'
import type { UserRole } from '@/types/database'

type DirectoryUser = {
  id: string; full_name: string; email: string; avatar_url: string | null;
  job_title: string | null; role: UserRole; dept_id: string | null; phone: string | null;
  is_active: boolean; last_login_at: string | null;
  departments?: { name: string } | null
}
type TeamWithMembers = {
  id: string; name: string; color: string;
  team_members?: Array<{ user_id: string }>
}

interface Props {
  users: DirectoryUser[]
  departments: Array<{ id: string; name: string }>
  teams: TeamWithMembers[]
}

const ROLES: UserRole[] = ['super_admin', 'org_admin', 'dept_head', 'team_leader', 'member', 'auditor', 'viewer']

export function DirectoryClient({ users, departments, teams }: Props) {
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null)

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchSearch = !search ||
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.job_title?.toLowerCase().includes(search.toLowerCase()) ?? false)
      const matchDept = !filterDept || u.dept_id === filterDept
      const matchRole = !filterRole || u.role === filterRole
      const matchTeam = !filterTeam || teams.find(t => t.id === filterTeam)?.team_members?.some(m => m.user_id === u.id)
      return matchSearch && matchDept && matchRole && matchTeam
    })
  }, [users, search, filterDept, filterRole, filterTeam, teams])

  const userTeams = (userId: string) =>
    teams.filter(t => t.team_members?.some(m => m.user_id === userId))

  const hasFilters = filterDept || filterRole || filterTeam

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Directory</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {users.length} active members in your organization
          </p>
        </div>
        <Link
          href="/directory/org-chart"
          className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <GitBranch className="h-4 w-4" /> Org Chart
        </Link>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-9 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <Popover.Root>
          <Popover.Trigger asChild>
            <button className={`inline-flex items-center gap-2 h-9 px-3 rounded-md border text-sm font-medium transition-colors ${hasFilters ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
              <SlidersHorizontal className="h-4 w-4" />
              Filters {hasFilters && `(${[filterDept, filterRole, filterTeam].filter(Boolean).length})`}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="z-50 w-72 bg-white rounded-xl border border-gray-200 shadow-lg p-4 space-y-4" align="end" sideOffset={8}>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Department</label>
                <select
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={filterDept}
                  onChange={e => setFilterDept(e.target.value)}
                >
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Role</label>
                <select
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={filterRole}
                  onChange={e => setFilterRole(e.target.value)}
                >
                  <option value="">All Roles</option>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Team</label>
                <select
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={filterTeam}
                  onChange={e => setFilterTeam(e.target.value)}
                >
                  <option value="">All Teams</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {hasFilters && (
                <button
                  onClick={() => { setFilterDept(''); setFilterRole(''); setFilterTeam('') }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          <button
            onClick={() => setView('grid')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Grid
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            List
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>

      {/* Grid View */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="lg" />
                <div>
                  <p className="font-semibold text-gray-900">{u.full_name}</p>
                  {u.job_title && <p className="text-xs text-gray-500 mt-0.5">{u.job_title}</p>}
                  {u.departments?.name && (
                    <p className="text-xs text-indigo-600 mt-1 font-medium">{u.departments.name}</p>
                  )}
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                  {ROLE_LABELS[u.role]}
                </span>
                {/* Team badges */}
                <div className="flex flex-wrap gap-1 justify-center">
                  {userTeams(u.id).slice(0, 2).map(t => (
                    <span
                      key={t.id}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: t.color }}
                    >
                      {t.name}
                    </span>
                  ))}
                  {userTeams(u.id).length > 2 && (
                    <span className="text-xs text-gray-400">+{userTeams(u.id).length - 2} more</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {filtered.map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className="w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{u.full_name}</p>
                <p className="text-sm text-gray-500 truncate">{u.email}</p>
              </div>
              <div className="hidden md:flex items-center gap-2">
                {u.job_title && <span className="text-sm text-gray-500">{u.job_title}</span>}
              </div>
              <div className="hidden sm:block text-sm text-gray-500 w-32 text-right">
                {u.departments?.name ?? '—'}
              </div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${ROLE_COLORS[u.role]}`}>
                {ROLE_LABELS[u.role]}
              </span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="py-16 text-center text-gray-500">
          <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p>No members match your filters.</p>
        </div>
      )}

      {/* Profile Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedUser(null)}>
          <div
            className="w-full max-w-sm h-full bg-white shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 space-y-5">
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕ Close</button>

              <div className="flex flex-col items-center gap-3 pt-2">
                <UserAvatar name={selectedUser.full_name} avatarUrl={selectedUser.avatar_url} size="lg" className="w-20 h-20 text-2xl" />
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900">{selectedUser.full_name}</h2>
                  {selectedUser.job_title && <p className="text-gray-500 text-sm">{selectedUser.job_title}</p>}
                  <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[selectedUser.role]}`}>
                    {ROLE_LABELS[selectedUser.role]}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                  <a href={`mailto:${selectedUser.email}`} className="text-indigo-600 hover:underline truncate">{selectedUser.email}</a>
                </div>
                {selectedUser.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                    <a href={`tel:${selectedUser.phone}`} className="text-indigo-600 hover:underline">{selectedUser.phone}</a>
                  </div>
                )}
                {selectedUser.departments?.name && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-gray-700">{selectedUser.departments.name}</span>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Teams</p>
                <div className="flex flex-wrap gap-2">
                  {userTeams(selectedUser.id).length === 0 ? (
                    <p className="text-sm text-gray-400">Not in any team</p>
                  ) : userTeams(selectedUser.id).map(t => (
                    <span
                      key={t.id}
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: t.color }}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>

              {selectedUser.last_login_at && (
                <p className="text-xs text-gray-400">
                  Last active {formatRelativeTime(selectedUser.last_login_at)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
