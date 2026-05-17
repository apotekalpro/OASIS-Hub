'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnalyticsFilterBar } from './analytics-filter-bar'
import { Zap, AlertTriangle, CheckCircle2, Clock, BarChart3 } from 'lucide-react'

interface AtemStats {
  total: number; pending: number; in_progress: number; completed: number
  blocked: number; overdue: number; urgent: number; high: number
}

interface DeptBreakdown {
  name: string; total: number; completed: number
}

interface AtemItem {
  id: string; status: string; priority: string; deadline: string | null; created_at: string
}

interface FilterDept { id: string; name: string }
interface FilterUser { id: string; full_name: string }
interface OutletOption { id: string; name: string; code: string }

interface Props {
  stats: AtemStats
  deptBreakdown: DeptBreakdown[]
  items: AtemItem[]
  scopeLabel: string
  filterOptions?: { departments: FilterDept[]; users: FilterUser[]; outlets: OutletOption[] }
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-500',
}

const TAB_LINKS = [
  { href: '?tab=tasks', label: 'Tasks' },
  { href: '?tab=atem', label: 'ATEM' },
  { href: '?tab=okr', label: 'OKR' },
  { href: '?tab=inspections', label: 'Inspections' },
]

export function AtemAnalyticsDashboard({ stats, deptBreakdown, items, scopeLabel, filterOptions }: Props) {
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" /> ATEM Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{scopeLabel}</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        {TAB_LINKS.map(t => (
          <Link key={t.href} href={t.href}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
              t.href.includes('atem')
                ? 'bg-white border-gray-200 text-indigo-700'
                : 'bg-gray-50 border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{t.label}</Link>
        ))}
      </div>

      {/* Filters */}
      {filterOptions && (
        <AnalyticsFilterBar
          departments={filterOptions.departments}
          users={filterOptions.users}
          outlets={filterOptions.outlets}
          tab="atem"
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-lg"><Zap className="h-5 w-5 text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{stats.total}</p><p className="text-sm text-gray-500">Total Items</p></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 rounded-lg"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{completionRate}%</p><p className="text-sm text-gray-500">Completion Rate</p></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{stats.overdue}</p><p className="text-sm text-gray-500">Overdue</p></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg"><Clock className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{stats.in_progress}</p><p className="text-sm text-gray-500">In Progress</p></div>
          </div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Status Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Pending', value: stats.pending, color: 'bg-gray-400' },
              { label: 'In Progress', value: stats.in_progress, color: 'bg-blue-500' },
              { label: 'Completed', value: stats.completed, color: 'bg-green-500' },
              { label: 'Blocked', value: stats.blocked, color: 'bg-red-500' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-24 shrink-0">{s.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className={`${s.color} h-2 rounded-full transition-all`}
                    style={{ width: stats.total > 0 ? `${(s.value / stats.total) * 100}%` : '0%' }} />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{s.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base">Priority Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Urgent', value: stats.urgent, color: 'bg-red-500' },
              { label: 'High', value: stats.high, color: 'bg-orange-500' },
              { label: 'Medium', value: stats.total - stats.urgent - stats.high - 0, color: 'bg-yellow-400' },
            ].map(p => (
              <div key={p.label} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-16 shrink-0">{p.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className={`${p.color} h-2 rounded-full transition-all`}
                    style={{ width: stats.total > 0 ? `${Math.max(0, (p.value / stats.total)) * 100}%` : '0%' }} />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{p.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Department Breakdown */}
        {deptBreakdown.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">By Department</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Department</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Total</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Done</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Rate</th>
                </tr></thead>
                <tbody>
                  {deptBreakdown.sort((a, b) => b.total - a.total).map((d, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{d.name}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{d.total}</td>
                      <td className="px-4 py-2 text-right text-green-600">{d.completed}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`text-xs font-medium ${d.total > 0 && d.completed / d.total >= 0.7 ? 'text-green-600' : 'text-amber-600'}`}>
                          {d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Recent Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Items</CardTitle>
              <Link href="/atem" className="text-xs text-indigo-600 hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No items yet</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {items.map(item => (
                  <li key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[item.priority] ?? ''}`}>
                      {item.priority}
                    </span>
                    {item.deadline && (
                      <span className="text-xs text-gray-400 shrink-0">{new Date(item.deadline).toLocaleDateString()}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
