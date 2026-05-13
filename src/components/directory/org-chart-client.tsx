'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Users, Building2, ArrowLeft } from 'lucide-react'
import { UserAvatar } from '@/components/ui/avatar'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'

type DeptRow = { id: string; name: string; parent_id: string | null; color: string; description: string | null }
type UserRow = { id: string; full_name: string; avatar_url: string | null; role: UserRole; dept_id: string | null; job_title: string | null }

interface Props {
  departments: DeptRow[]
  users: UserRow[]
  orgName: string
}

function buildTree(departments: DeptRow[], parentId: string | null = null): DeptRow[] {
  return departments.filter(d => d.parent_id === parentId)
}

function DeptNode({
  dept, departments, users, level
}: {
  dept: DeptRow
  departments: DeptRow[]
  users: UserRow[]
  level: number
}) {
  const [expanded, setExpanded] = useState(true)
  const children = buildTree(departments, dept.id)
  const deptUsers = users.filter(u => u.dept_id === dept.id)
  const deptHead = deptUsers.find(u => u.role === 'dept_head')
  const hasChildren = children.length > 0

  return (
    <div className="relative">
      {/* Connector line (not at root level) */}
      {level > 0 && (
        <div className="absolute left-[-1px] top-0 bottom-0 w-px bg-gray-200" />
      )}

      <div className="ml-6 mb-4">
        {level > 0 && (
          <div className="absolute left-[-1px] top-6 w-6 h-px bg-gray-200" />
        )}

        {/* Dept card */}
        <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Color top bar */}
          <div className="h-1.5 w-full" style={{ backgroundColor: dept.color }} />

          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0" style={{ color: dept.color }} />
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{dept.name}</h3>
                  {dept.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{dept.description}</p>
                  )}
                </div>
              </div>
              {(hasChildren || deptUsers.length > 0) && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              )}
            </div>

            {/* Dept Head */}
            {deptHead && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-indigo-50 rounded-lg">
                <UserAvatar name={deptHead.full_name} avatarUrl={deptHead.avatar_url} size="sm" />
                <div>
                  <p className="text-xs font-medium text-gray-900">{deptHead.full_name}</p>
                  <p className="text-xs text-indigo-600">Dept Head</p>
                </div>
              </div>
            )}

            {/* Member count */}
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
              <Users className="h-3 w-3" />
              <span>{deptUsers.length} member{deptUsers.length !== 1 ? 's' : ''}</span>
              {children.length > 0 && (
                <span className="ml-2">· {children.length} sub-dept{children.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Other members preview */}
            {expanded && deptUsers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Members</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {deptUsers.filter(u => u.id !== deptHead?.id).map(u => (
                    <div key={u.id} className="flex items-center gap-2">
                      <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6 text-xs" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 truncate">{u.full_name}</p>
                        {u.job_title && <p className="text-xs text-gray-400 truncate">{u.job_title}</p>}
                      </div>
                      <span className={`ml-auto inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium shrink-0 ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role].split(' ').pop()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Children */}
        {expanded && hasChildren && (
          <div className="mt-2 relative pl-4 border-l border-gray-200">
            {children.map(child => (
              <DeptNode
                key={child.id}
                dept={child}
                departments={departments}
                users={users}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function OrgChartClient({ departments, users, orgName }: Props) {
  const rootDepts = buildTree(departments, null)
  const unassignedUsers = users.filter(u => !u.dept_id)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/directory" className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm">
          <ArrowLeft className="h-4 w-4" /> Directory
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Org Chart</h1>
          <p className="text-gray-500 text-sm mt-0.5">{orgName} — {departments.length} departments, {users.length} members</p>
        </div>
      </div>

      {/* Org root */}
      <div className="flex flex-col items-start">
        <div className="bg-indigo-600 rounded-2xl px-6 py-4 text-white mb-6 shadow-lg">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6" />
            <div>
              <p className="font-bold text-lg">{orgName}</p>
              <p className="text-indigo-200 text-sm">{users.length} total members</p>
            </div>
          </div>
        </div>

        {/* Department tree */}
        {rootDepts.length > 0 ? (
          <div className="pl-4 border-l-2 border-indigo-200 space-y-2 w-full">
            {rootDepts.map(dept => (
              <DeptNode
                key={dept.id}
                dept={dept}
                departments={departments}
                users={users}
                level={0}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p>No departments configured yet.</p>
          </div>
        )}

        {/* Unassigned */}
        {unassignedUsers.length > 0 && (
          <div className="mt-6 bg-gray-50 rounded-xl border border-dashed border-gray-300 p-4 w-full max-w-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Unassigned ({unassignedUsers.length})
            </p>
            <div className="space-y-2">
              {unassignedUsers.map(u => (
                <div key={u.id} className="flex items-center gap-2">
                  <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" />
                  <div>
                    <p className="text-sm text-gray-700">{u.full_name}</p>
                    <p className="text-xs text-gray-400">{ROLE_LABELS[u.role]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
