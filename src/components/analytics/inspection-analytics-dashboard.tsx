'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, CheckCircle2, Clock, TrendingUp, Building2,
  Users, ClipboardCheck, BarChart3, ChevronUp, ChevronDown,
} from 'lucide-react'
import { KpiDonut } from './kpi-donut'
import { TrendAreaChart } from './trend-area-chart'
import { HorizontalBarChart } from './horizontal-bar-chart'
import { SeverityDonut } from './severity-donut'
import { AnalyticsFilterBar } from './analytics-filter-bar'
import { cn } from '@/lib/utils'

type SeverityRow = { severity: string; total: number; open_count: number; resolved_count: number }
type OutletStat = { outlet_id: string; outlet_name: string; outlet_code: string; total_issues: number; open_issues: number; resolved_issues: number; total_sessions: number; completed_sessions: number; completion_rate: number; irr: number }
type TrendRow = { day: string; opened: number; resolved: number; escalated: number; in_progress: number }
type SessionTrendRow = { day: string; scheduled: number; completed: number; missed: number }
type UserStat = { user_id: string; full_name: string; avatar_url: string; sessions_conducted: number; sessions_completed: number; issues_raised: number; issues_resolved: number; completion_rate: number }
type IssueCounts = { total: number; open: number; in_progress: number; escalated: number; resolved: number; closed: number }

interface FilterDept { id: string; name: string }
interface FilterUser { id: string; full_name: string }
interface OutletOption { id: string; name: string; code: string }

interface Props {
  irr: number
  rcr: number
  severity: SeverityRow[]
  outletStats: OutletStat[]
  issueTrend: TrendRow[]
  sessionTrend: SessionTrendRow[]
  avgResolutionHours: number
  avgResolutionMins: number
  userStats: UserStat[]
  issueCounts: IssueCounts
  filterOptions?: { departments: FilterDept[]; users: FilterUser[]; outlets: OutletOption[] }
}

type MainTab = 'executive' | 'operational' | 'issues'

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'executive', label: 'Executive Summary' },
  { key: 'operational', label: 'Operational KPI' },
  { key: 'issues', label: 'Issue Insights' },
]

export function InspectionAnalyticsDashboard({
  irr, rcr, severity, outletStats, issueTrend, sessionTrend,
  avgResolutionHours, avgResolutionMins, userStats, issueCounts, filterOptions,
}: Props) {
  const [tab, setTab] = useState<MainTab>('executive')
  const [trendMode, setTrendMode] = useState<'issues' | 'reports'>('issues')
  const [siteView, setSiteView] = useState<'top' | 'bottom'>('top')
  const [userView, setUserView] = useState<'top' | 'bottom'>('top')

  const now = new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })

  // Format trend data for chart
  const issueTrendFormatted = issueTrend.map(r => ({
    label: new Date(r.day).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    opened: Number(r.opened),
    resolved: Number(r.resolved),
    escalated: Number(r.escalated),
    in_progress: Number(r.in_progress),
  }))

  const sessionTrendFormatted = sessionTrend.map(r => ({
    label: new Date(r.day).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    scheduled: Number(r.scheduled),
    completed: Number(r.completed),
    missed: Number(r.missed),
  }))

  // Site bar data sorted
  const sitesByIssues = [...outletStats].sort((a, b) =>
    siteView === 'top' ? b.open_issues - a.open_issues : a.open_issues - b.open_issues
  ).slice(0, 10).map(o => ({
    label: o.outlet_code || o.outlet_name.slice(0, 12),
    value: Number(o.open_issues),
  }))

  const sitesByReports = [...outletStats].sort((a, b) =>
    siteView === 'top' ? b.completion_rate - a.completion_rate : a.completion_rate - b.completion_rate
  ).slice(0, 10).map(o => ({
    label: o.outlet_code || o.outlet_name.slice(0, 12),
    value: Number(o.completion_rate),
  }))

  const [siteChartMode, setSiteChartMode] = useState<'issues' | 'reports'>('issues')

  // User bar data
  const usersByCompletion = [...userStats].sort((a, b) =>
    userView === 'top' ? b.completion_rate - a.completion_rate : a.completion_rate - b.completion_rate
  ).slice(0, 8).map(u => ({
    label: u.full_name.split(' ')[0],
    value: Number(u.completion_rate),
  }))

  const openPct = issueCounts.total > 0
    ? Math.round((issueCounts.open + issueCounts.in_progress + issueCounts.escalated) / issueCounts.total * 100)
    : 0

  const missedReports = sessionTrend.reduce((s, r) => s + Number(r.missed), 0)
  const totalScheduled = sessionTrend.reduce((s, r) => s + Number(r.scheduled), 0)
  const missedPct = totalScheduled > 0 ? Math.round(missedReports / totalScheduled * 100) : 0

  const openedLastWeek = issueTrend.slice(-7).reduce((s, r) => s + Number(r.opened), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <div className="bg-white border-b border-gray-200 px-6 py-0">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex">
            {MAIN_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'px-5 py-4 text-sm font-medium border-b-2 transition-colors',
                  tab === t.key
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/analytics" className="text-indigo-600 font-medium hover:underline">← Tasks</Link>
            <span>Last Updated: {now}</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-6 space-y-5">

        {/* Filters */}
        {filterOptions && (
          <Suspense fallback={null}>
            <AnalyticsFilterBar
              departments={filterOptions.departments}
              users={filterOptions.users}
              outlets={filterOptions.outlets}
              tab="inspections"
            />
          </Suspense>
        )}

        {/* ═══════════════ EXECUTIVE SUMMARY ═══════════════ */}
        {tab === 'executive' && (
          <>
            {/* Row 1: KPI donuts + Issues + Reports */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* KPI Overview */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                  <p className="font-semibold text-gray-700 text-sm">KPI Overview</p>
                </div>
                <div className="flex justify-around">
                  <KpiDonut
                    value={irr}
                    label="Issue Resolution Rate"
                    sublabel="Drill Into"
                    color="#6366f1"
                    size="md"
                    trend={irr >= 50 ? 'up' : 'down'}
                  />
                  <KpiDonut
                    value={rcr}
                    label="Report Completion Rate"
                    sublabel="Drill Into"
                    color="#06b6d4"
                    size="md"
                    trend={rcr >= 70 ? 'up' : 'down'}
                  />
                </div>
              </div>

              {/* Issues panel */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="h-4 w-4 text-gray-400" />
                  <p className="font-semibold text-gray-700 text-sm">Issues</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{issueCounts.resolved + issueCounts.closed}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Resolved Issues</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{issueCounts.open + issueCounts.in_progress + issueCounts.escalated}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Open Issues</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{issueCounts.total}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Total Issues</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{openedLastWeek}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Opened Last Week</p>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-4 text-center">
                  <p className={cn('text-3xl font-bold', openPct > 50 ? 'text-red-500' : 'text-amber-500')}>{openPct}%</p>
                  <p className="text-sm font-semibold text-gray-600 mt-0.5">Open Issues</p>
                </div>
                <div className="mt-4 text-center text-sm text-gray-500">
                  <p className="text-xs text-gray-400">Average Issue Resolution Time</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{avgResolutionHours} hours {avgResolutionMins} minutes</p>
                </div>
                <Link href="/inspections/issues" className="block mt-3 text-center text-xs font-medium text-indigo-600 hover:underline">
                  Click for deeper insights →
                </Link>
              </div>

              {/* Reports/Sessions panel */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardCheck className="h-4 w-4 text-gray-400" />
                  <p className="font-semibold text-gray-700 text-sm">Reports</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{totalScheduled}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Total Reports</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{sessionTrend.reduce((s, r) => s + Number(r.completed), 0)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{missedReports}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Missed Reports</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{totalScheduled - sessionTrend.reduce((s, r) => s + Number(r.completed), 0) - missedReports}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Pending</p>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-4 text-center">
                  <p className={cn('text-3xl font-bold', missedPct > 10 ? 'text-red-500' : 'text-amber-500')}>{missedPct}%</p>
                  <p className="text-sm font-semibold text-gray-600 mt-0.5">Missed Reports</p>
                </div>
                <Link href="/inspections" className="block mt-7 text-center text-xs font-medium text-indigo-600 hover:underline">
                  Click for deeper insights →
                </Link>
              </div>
            </div>

            {/* Row 2: Top Sites + Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Top Sites */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                    <p className="font-semibold text-gray-700 text-sm">Top Sites</p>
                  </div>
                  <div className="flex gap-1">
                    {(['issues', 'reports'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setSiteChartMode(m)}
                        className={cn(
                          'px-3 py-1 text-xs font-medium rounded-lg border transition-colors',
                          siteChartMode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        )}
                      >
                        {m === 'issues' ? 'Issues' : 'Reports'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 mb-3">
                  {(['top', 'bottom'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setSiteView(v)}
                      className={cn('text-xs px-2 py-1 rounded-lg border transition-colors', siteView === v ? 'border-indigo-400 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-400')}
                    >
                      {v === 'top' ? 'Top 10' : 'Bottom 10'}
                    </button>
                  ))}
                </div>
                <HorizontalBarChart
                  data={siteChartMode === 'issues' ? sitesByIssues : sitesByReports}
                  color={siteChartMode === 'issues' ? '#6366f1' : '#06b6d4'}
                  valueLabel={siteChartMode === 'issues' ? 'Open Issues' : 'Completion %'}
                  height={280}
                />
              </div>

              {/* Trends */}
              <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-semibold text-gray-700 text-sm">Trends (14 days)</p>
                  <div className="flex gap-1">
                    {(['issues', 'reports'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setTrendMode(m)}
                        className={cn(
                          'px-3 py-1 text-xs font-medium rounded-lg border transition-colors',
                          trendMode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        )}
                      >
                        {m === 'issues' ? 'Issues' : 'Reports'}
                      </button>
                    ))}
                  </div>
                </div>
                {trendMode === 'issues' ? (
                  <TrendAreaChart
                    data={issueTrendFormatted}
                    series={[
                      { key: 'opened', label: 'Opened Issues', color: '#6366f1' },
                      { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
                      { key: 'resolved', label: 'Resolved Issues', color: '#22c55e' },
                      { key: 'escalated', label: 'Escalated', color: '#ef4444' },
                    ]}
                    height={280}
                  />
                ) : (
                  <TrendAreaChart
                    data={sessionTrendFormatted}
                    series={[
                      { key: 'scheduled', label: 'Scheduled', color: '#6366f1' },
                      { key: 'completed', label: 'Completed', color: '#22c55e' },
                      { key: 'missed', label: 'Missed', color: '#ef4444' },
                    ]}
                    height={280}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {/* ═══════════════ OPERATIONAL KPI ═══════════════ */}
        {tab === 'operational' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: Site Performance */}
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <p className="font-semibold text-gray-700 text-sm">Site Performance</p>
                    </div>
                    <div className="mt-2 space-y-0.5">
                      <p className="text-2xl font-bold text-amber-500">{rcr.toFixed(2)}%</p>
                      <p className="text-xs text-gray-500">Report Completion Rate</p>
                      <p className="text-sm font-semibold text-gray-700 mt-1">{irr.toFixed(2)}%</p>
                      <p className="text-xs text-gray-400">Based on issues</p>
                      <p className="text-sm font-semibold text-gray-700 mt-1">{rcr.toFixed(1)}%</p>
                      <p className="text-xs text-gray-400">Based on reports</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {(['top', 'bottom'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setSiteView(v)}
                        className={cn('text-xs px-2 py-1 rounded-full border flex items-center gap-1', siteView === v ? 'border-indigo-400 text-indigo-700 bg-indigo-50' : 'border-gray-200 text-gray-400')}
                      >
                        {v === 'top' ? '↑ Top 10' : '↓ Bottom 10'}
                      </button>
                    ))}
                    <select
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600"
                      value={siteChartMode}
                      onChange={e => setSiteChartMode(e.target.value as 'issues' | 'reports')}
                    >
                      <option value="issues">Open Issues Count</option>
                      <option value="reports">Completion Rate %</option>
                    </select>
                  </div>
                </div>
                <HorizontalBarChart
                  data={siteChartMode === 'issues' ? sitesByIssues : sitesByReports}
                  color="#6366f1"
                  valueLabel={siteChartMode === 'issues' ? 'Open Issues' : 'Completion %'}
                  height={300}
                />
              </div>

              {/* User Performance */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <p className="font-semibold text-gray-700 text-sm">Users Performance</p>
                    </div>
                    <p className="text-2xl font-bold text-amber-500 mt-2">
                      {userStats.length > 0 ? (userStats.reduce((s, u) => s + Number(u.completion_rate), 0) / userStats.length).toFixed(2) : '0.00'}%
                    </p>
                    <p className="text-xs text-gray-500">Avg Completion Rate</p>
                  </div>
                  <div className="flex gap-2">
                    {(['top', 'bottom'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setUserView(v)}
                        className={cn('text-xs px-2 py-1 rounded-full border', userView === v ? 'border-indigo-400 text-indigo-700 bg-indigo-50' : 'border-gray-200 text-gray-400')}
                      >
                        {v === 'top' ? '↑ Top 10' : '↓ Bottom 10'}
                      </button>
                    ))}
                  </div>
                </div>
                <HorizontalBarChart
                  data={usersByCompletion}
                  color="#8b5cf6"
                  valueLabel="Completion %"
                  height={260}
                />
              </div>
            </div>

            {/* Right: KPI sidebar */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <p className="text-xs text-gray-400 mb-1">Issue Resolution Rate</p>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-gray-900">{irr.toFixed(2)}%</p>
                  <span className={cn('text-sm font-bold mb-0.5', irr >= 50 ? 'text-green-500' : 'text-red-500')}>
                    {irr >= 50 ? '↑' : '↓'}
                  </span>
                </div>
                <KpiDonut value={irr} label="" color="#6366f1" size="sm" />
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <p className="text-xs text-gray-400 mb-1">Report Completion Rate</p>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-gray-900">{rcr.toFixed(0)}%</p>
                  <span className={cn('text-sm font-bold mb-0.5', rcr >= 70 ? 'text-green-500' : 'text-red-500')}>
                    {rcr >= 70 ? '↑' : '↓'}
                  </span>
                </div>
                <KpiDonut value={rcr} label="" color="#06b6d4" size="sm" />
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <p className="text-xs text-gray-400 mb-2">Lowest Performing Outlet</p>
                <p className="font-bold text-red-500 text-sm">
                  {outletStats.sort((a, b) => a.completion_rate - b.completion_rate)[0]?.outlet_name ?? '—'}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <p className="text-xs text-gray-400 mb-1">Escalated Issues</p>
                <p className={cn('text-2xl font-bold', issueCounts.escalated > 0 ? 'text-red-600' : 'text-green-600')}>
                  {issueCounts.escalated > 0
                    ? `${Math.round(issueCounts.escalated / (issueCounts.total || 1) * 100)}% ↑`
                    : '0% ✓'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ ISSUE INSIGHTS ═══════════════ */}
        {tab === 'issues' && (
          <div className="space-y-5">
            {/* Row 1: Status donut + Severity donut + Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Issue Status */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <p className="font-semibold text-gray-700 text-sm mb-4">Issue Status</p>
                <div className="flex justify-center">
                  <KpiDonut
                    value={issueCounts.total > 0 ? Math.round((issueCounts.resolved + issueCounts.closed) / issueCounts.total * 100) : 0}
                    label=""
                    color="#22c55e"
                    size="lg"
                  />
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    { label: 'Resolved Issues', value: issueCounts.resolved + issueCounts.closed, color: '#22c55e' },
                    { label: 'Opened Issues', value: issueCounts.open + issueCounts.in_progress + issueCounts.escalated, color: '#6366f1' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-xs text-gray-600 flex-1">{s.label}</span>
                      <span className="text-xs font-bold text-gray-900">{s.value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">Click on the chart section for more insights.</p>
              </div>

              {/* Severity Breakdown */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <p className="font-semibold text-gray-700 text-sm mb-2">Severity</p>
                <SeverityDonut data={severity} height={240} />
              </div>

              {/* Right stats */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Issue Opened', value: issueCounts.open + issueCounts.in_progress + issueCounts.escalated, color: 'text-indigo-600' },
                    { label: 'Issue Closed', value: issueCounts.resolved + issueCounts.closed, color: 'text-green-600' },
                    { label: 'Escalated', value: issueCounts.escalated, color: 'text-red-600' },
                  ].map(s => (
                    <div key={s.label}>
                      <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-400 mb-1">Average Issue Resolution Time</p>
                  <p className="text-xl font-bold text-indigo-600">
                    {avgResolutionHours}h {avgResolutionMins}m
                  </p>
                </div>
                {severity.length > 0 && (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs text-gray-400 mb-1">Highest Severity Bucket</p>
                    <p className="font-bold text-red-600 capitalize">
                      {[...severity].sort((a, b) => b.open_count - a.open_count)[0]?.severity ?? '—'}
                    </p>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-400 mb-1">Opened Last 7 Days</p>
                  <p className={cn('font-bold', openedLastWeek > 0 ? 'text-amber-600' : 'text-green-600')}>
                    {openedLastWeek} {openedLastWeek > 0 ? '↑' : '✓'}
                  </p>
                </div>
              </div>
            </div>

            {/* Issue Count Table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <p className="font-semibold text-gray-700 text-sm">Issue Count by Outlet</p>
                <Link href="/inspections/issues" className="text-xs font-medium text-indigo-600 hover:underline">View Details →</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Outlet</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-red-500">Critical/High</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-amber-500">Medium/Low</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-green-500">Resolved</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Sessions</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Completion</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">IRR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {outletStats.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-gray-400 text-xs">No outlet data yet</td>
                      </tr>
                    ) : outletStats.slice(0, 15).map(outlet => (
                      <tr key={outlet.outlet_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900 text-xs">{outlet.outlet_name}</p>
                          {outlet.outlet_code && <p className="text-xs text-gray-400 font-mono">{outlet.outlet_code}</p>}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-gray-900 text-xs">{outlet.total_issues}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn('text-xs font-medium', outlet.open_issues > 0 ? 'text-red-600' : 'text-gray-400')}>
                            {outlet.open_issues}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-amber-600">{Math.max(0, outlet.total_issues - outlet.open_issues - outlet.resolved_issues)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-medium text-green-600">{outlet.resolved_issues}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-600">{outlet.total_sessions}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            outlet.completion_rate >= 80 ? 'bg-green-100 text-green-700' : outlet.completion_rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          )}>
                            {outlet.completion_rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            outlet.irr >= 70 ? 'bg-green-100 text-green-700' : outlet.irr >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          )}>
                            {outlet.irr}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
