'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AnalyticsFilterBar } from './analytics-filter-bar'
import { Award, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface PillarStats {
  total: number; not_started: number; in_progress: number; at_risk: number
  completed: number; cancelled: number; avg_progress: number
}

interface DeptBreakdown {
  name: string; total: number; completed: number; avg_progress: number
}

interface FilterDept { id: string; name: string }
interface FilterUser { id: string; full_name: string }
interface OutletOption { id: string; name: string; code: string }

interface Props {
  stats: PillarStats
  deptBreakdown: DeptBreakdown[]
  scopeLabel: string
  filterOptions?: { departments: FilterDept[]; users: FilterUser[]; outlets: OutletOption[] }
}

const TAB_LINKS = [
  { href: '?tab=tasks', label: 'Tasks' },
  { href: '?tab=atem', label: 'ATEM' },
  { href: '?tab=okr', label: 'OKR' },
  { href: '?tab=inspections', label: 'Inspections' },
  { href: '?tab=pillar', label: 'Pillar' },
]

const STATUS_BARS = [
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { key: 'at_risk', label: 'At Risk', color: 'bg-amber-500' },
  { key: 'completed', label: 'Completed', color: 'bg-green-500' },
  { key: 'not_started', label: 'Not Started', color: 'bg-gray-300' },
  { key: 'cancelled', label: 'Cancelled', color: 'bg-gray-200' },
] as const

export function PillarAnalyticsDashboard({ stats, deptBreakdown, scopeLabel, filterOptions }: Props) {
  const achievementRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="h-6 w-6 text-orange-500" /> Pillar Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{scopeLabel}</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TAB_LINKS.map(t => (
          <Link key={t.href} href={t.href}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
              t.href.includes('pillar')
                ? 'bg-white border-gray-200 text-orange-700'
                : 'bg-gray-50 border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{t.label}</Link>
        ))}
      </div>

      {filterOptions && (
        <Suspense fallback={null}>
          <AnalyticsFilterBar
            departments={filterOptions.departments}
            users={filterOptions.users}
            outlets={filterOptions.outlets}
            tab="pillar"
          />
        </Suspense>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 rounded-lg"><Award className="h-5 w-5 text-orange-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{stats.total}</p><p className="text-sm text-gray-500">Pillars</p></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 rounded-lg"><TrendingUp className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{stats.avg_progress}%</p><p className="text-sm text-gray-500">Avg Progress</p></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{stats.at_risk}</p><p className="text-sm text-gray-500">At Risk</p></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-lg"><CheckCircle2 className="h-5 w-5 text-purple-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{achievementRate}%</p><p className="text-sm text-gray-500">Achievement Rate</p></div>
          </div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Pillar Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {STATUS_BARS.map(s => (
              <div key={s.key} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-28 shrink-0">{s.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className={`${s.color} h-2 rounded-full transition-all`}
                    style={{ width: stats.total > 0 ? `${(stats[s.key] / stats.total) * 100}%` : '0%' }} />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{stats[s.key]}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Average Progress</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center py-4">
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f97316" strokeWidth="3"
                  strokeDasharray={`${stats.avg_progress} ${100 - stats.avg_progress}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-gray-900">{stats.avg_progress}%</span>
                <span className="text-xs text-gray-500">avg</span>
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-sm text-gray-600">
              <span><span className="font-medium text-blue-600">{stats.in_progress}</span> in progress</span>
              <span><span className="font-medium text-amber-600">{stats.at_risk}</span> at risk</span>
              <span><span className="font-medium text-green-600">{stats.completed}</span> completed</span>
            </div>
          </CardContent>
        </Card>

        {deptBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">By Department</CardTitle>
                <Link href="/admin/pillar-rewards" className="text-xs text-orange-600 hover:underline">View Reward Report</Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Department</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Pillars</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Done</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Avg %</th>
                </tr></thead>
                <tbody>
                  {deptBreakdown.sort((a, b) => b.total - a.total).map((d, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{d.name}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{d.total}</td>
                      <td className="px-4 py-2 text-right text-green-600">{d.completed}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`text-xs font-medium ${d.avg_progress >= 70 ? 'text-green-600' : d.avg_progress >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {d.avg_progress}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
