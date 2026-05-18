'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Dept = { id: string; name: string }
type OrgUser = { id: string; full_name: string }
type Outlet = { id: string; name: string; code: string }

interface Props {
  departments: Dept[]
  users: OrgUser[]
  outlets: Outlet[]
  tab: string
}

export function AnalyticsFilterBar({ departments, users, outlets, tab }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const currentDept = searchParams.get('dept_filter') ?? ''
  const currentUser = searchParams.get('user_filter') ?? ''
  const currentOutlet = searchParams.get('outlet_filter') ?? ''

  const activeCount = [currentDept, currentUser, currentOutlet].filter(Boolean).length

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('dept_filter')
    params.delete('user_filter')
    params.delete('outlet_filter')
    router.push(`${pathname}?${params.toString()}`)
  }

  const selectClass = "h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
  const activeSelectClass = "border-indigo-400 bg-indigo-50 text-indigo-700 font-medium"

  return (
    <div className="flex items-center gap-2 flex-wrap bg-white rounded-xl border border-gray-200 px-4 py-2.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 shrink-0">
        <Filter className="h-3.5 w-3.5" />
        Filter by
      </span>

      {departments.length > 0 && (
        <select
          value={currentDept}
          onChange={e => update('dept_filter', e.target.value)}
          className={cn(selectClass, currentDept && activeSelectClass)}
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      )}

      {tab === 'inspections' && outlets.length > 0 && (
        <select
          value={currentOutlet}
          onChange={e => update('outlet_filter', e.target.value)}
          className={cn(selectClass, currentOutlet && activeSelectClass)}
        >
          <option value="">All Outlets</option>
          {outlets.map(o => (
            <option key={o.id} value={o.id}>{o.code} — {o.name}</option>
          ))}
        </select>
      )}

      {users.length > 0 && tab !== 'inspections' && (
        <select
          value={currentUser}
          onChange={e => update('user_filter', e.target.value)}
          className={cn(selectClass, currentUser && activeSelectClass)}
        >
          <option value="">All Users</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </select>
      )}

      {activeCount > 0 && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
          <span className="ml-0.5 bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{activeCount}</span>
        </button>
      )}
    </div>
  )
}
