'use client'

import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  CheckSquare, AlertTriangle, Clock, TrendingUp, Users,
  BarChart3, ClipboardList, Zap, Target
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MiniSparkline } from './mini-sparkline'
import { BarChart } from './bar-chart'
import { DonutChart } from './donut-chart'

type TaskStats = { total: number; todo: number; in_progress: number; in_review: number; done: number; cancelled: number; overdue: number; urgent: number; high: number }
type TrendRow = { day: string; completed: number; created: number }
type TeamStat = { team_id: string; team_name: string; total: number; done: number; overdue: number }
type Contributor = { user_id: string; full_name: string; avatar_url: string | null; completed: number; in_progress: number }
type FormDeptStat = { dept_name: string; total: number; approved: number; rejected: number; avg_score: number | null }
type RecentTask = { id: string; title: string; status: string; created_at: string }

interface Props {
  taskStats: TaskStats
  trend: TrendRow[]
  teamStats: TeamStat[]
  contributors: Contributor[]
  formDeptStats: FormDeptStat[]
  activeUsers: number
  priorityCounts: Record<string, number>
  recentTasks: RecentTask[]
  completionRate: number
}

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-400', in_progress: 'bg-blue-500', in_review: 'bg-amber-500', done: 'bg-green-500', cancelled: 'bg-gray-300',
}
const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-blue-500', low: 'bg-gray-400',
}

export function AnalyticsDashboard({ taskStats, trend, teamStats, contributors, formDeptStats, activeUsers, priorityCounts, recentTasks, completionRate }: Props) {
  const trendCompleted = trend.map(t => t.completed)
  const trendCreated = trend.map(t => t.created)
  const trendLabels = trend.map(t => {
    const d = new Date(t.day)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })

  const statusDonut = [
    { label: 'To Do', value: taskStats.todo, color: '#9ca3af' },
    { label: 'In Progress', value: taskStats.in_progress, color: '#3b82f6' },
    { label: 'In Review', value: taskStats.in_review, color: '#f59e0b' },
    { label: 'Done', value: taskStats.done, color: '#22c55e' },
    { label: 'Cancelled', value: taskStats.cancelled, color: '#e5e7eb' },
  ].filter(d => d.value > 0)

  const priorityBar = ['urgent', 'high', 'medium', 'low'].map(p => ({
    label: p.charAt(0).toUpperCase() + p.slice(1),
    value: priorityCounts[p] ?? 0,
    color: p === 'urgent' ? '#ef4444' : p === 'high' ? '#f97316' : p === 'medium' ? '#3b82f6' : '#9ca3af',
  }))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Organisation-wide performance overview</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {[
          { icon: CheckSquare, label: 'Total Tasks', value: taskStats.total, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { icon: TrendingUp, label: 'Completion Rate', value: `${completionRate}%`, color: 'text-green-600', bg: 'bg-green-50' },
          { icon: AlertTriangle, label: 'Overdue', value: taskStats.overdue, color: 'text-red-600', bg: 'bg-red-50' },
          { icon: Clock, label: 'In Progress', value: taskStats.in_progress, color: 'text-blue-600', bg: 'bg-blue-50' },
          { icon: Users, label: 'Active Members', value: activeUsers, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', kpi.bg)}>
              <kpi.icon className={cn('h-5 w-5', kpi.color)} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Trend + Status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 30-day trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Task Activity — Last 30 Days</h3>
              <p className="text-xs text-gray-400 mt-0.5">Created vs completed per day</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Created</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Completed</span>
            </div>
          </div>
          <MiniSparkline
            datasets={[
              { values: trendCreated, color: '#6366f1', label: 'Created' },
              { values: trendCompleted, color: '#22c55e', label: 'Completed' },
            ]}
            labels={trendLabels}
            height={120}
          />
        </div>

        {/* Status donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Tasks by Status</h3>
          <DonutChart data={statusDonut} total={taskStats.total} centerLabel="Total" />
          <div className="mt-4 space-y-2">
            {statusDonut.map(d => (
              <div key={d.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600">{d.label}</span>
                </div>
                <span className="font-medium text-gray-700">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Priority + Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Open tasks by priority */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Open Tasks by Priority</h3>
          <BarChart data={priorityBar} />
        </div>

        {/* Teams leaderboard */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Team Performance</h3>
          <div className="space-y-3">
            {teamStats.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No team data</p>}
            {teamStats.map(team => {
              const pct = team.total > 0 ? Math.round((team.done / team.total) * 100) : 0
              return (
                <div key={team.team_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700 truncate max-w-[160px]">{team.team_name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      {team.overdue > 0 && (
                        <span className="text-red-500">{team.overdue} overdue</span>
                      )}
                      <span className="text-gray-500">{team.done}/{team.total}</span>
                      <span className="font-semibold text-gray-900 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={cn('h-1.5 rounded-full transition-all', pct >= 75 ? 'bg-green-500' : pct >= 40 ? 'bg-blue-500' : 'bg-amber-500')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Contributors + Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top contributors */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Top Contributors
          </h3>
          <div className="space-y-3">
            {contributors.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data yet</p>}
            {contributors.map((c, i) => (
              <div key={c.user_id} className="flex items-center gap-3">
                <span className={cn('text-xs font-bold w-5 text-center shrink-0', i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-gray-300')}>
                  #{i + 1}
                </span>
                <UserAvatar name={c.full_name} avatarUrl={c.avatar_url} size="sm" className="w-7 h-7 shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">{c.full_name}</span>
                <div className="flex items-center gap-2 text-xs shrink-0">
                  <span className="text-green-600 font-medium">{c.completed} done</span>
                  {c.in_progress > 0 && <span className="text-blue-500">{c.in_progress} active</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Forms by department */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-indigo-500" />
            Form Submissions by Department
          </h3>
          <div className="space-y-3">
            {formDeptStats.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No submission data</p>}
            {formDeptStats.map(d => (
              <div key={d.dept_name} className="flex items-center gap-3 text-sm">
                <span className="flex-1 text-gray-700 font-medium truncate">{d.dept_name}</span>
                <div className="flex items-center gap-2 text-xs shrink-0">
                  <span className="text-gray-500">{d.total} total</span>
                  <span className="text-green-600">{d.approved} ✓</span>
                  {d.rejected > 0 && <span className="text-red-500">{d.rejected} ✗</span>}
                  {d.avg_score !== null && <span className="text-gray-500 font-medium">{d.avg_score}%</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent tasks */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-500" />
          Recently Created Tasks
        </h3>
        <div className="space-y-2">
          {recentTasks.map(t => (
            <div key={t.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
              <span className={cn('h-2 w-2 rounded-full shrink-0', STATUS_COLORS[t.status] ?? 'bg-gray-300')} />
              <span className="flex-1 text-gray-700 truncate">{t.title}</span>
              <Badge variant={t.status === 'done' ? 'success' : t.status === 'in_progress' ? 'default' : 'secondary'} className="shrink-0 text-xs">
                {t.status.replace('_', ' ')}
              </Badge>
            </div>
          ))}
          {recentTasks.length === 0 && <p className="text-sm text-gray-400 text-center py-2">No tasks yet</p>}
        </div>
      </div>
    </div>
  )
}
