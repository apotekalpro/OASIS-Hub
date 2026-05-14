import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasRole } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profileRes = await supabase
    .from('profiles')
    .select('org_id, role, dept_id, full_name')
    .eq('id', user.id)
    .single()

  const profile = profileRes.data as {
    org_id: string; role: UserRole; dept_id: string | null; full_name: string
  } | null

  if (!profile) redirect('/login')

  const { org_id: orgId, role, dept_id: deptId } = profile
  const isOrgWide = hasRole(role, 'org_admin')
  const isDeptLevel = !isOrgWide && hasRole(role, 'dept_head')

  // Build task query scope
  let taskQuery = supabase.from('tasks').select(
    'id, status, priority, due_date, created_at, created_by, dept_id, team_id'
  )

  if (isOrgWide) {
    taskQuery = taskQuery.eq('org_id', orgId)
  } else if (isDeptLevel && deptId) {
    taskQuery = taskQuery.eq('dept_id', deptId)
  } else {
    // member / team_leader / auditor — show tasks assigned to or created by them
    const [assignedRes, createdRes] = await Promise.all([
      supabase.from('task_assignees').select('task_id').eq('user_id', user.id),
      supabase.from('tasks').select('id').eq('created_by', user.id),
    ])
    const assignedIds = (assignedRes.data ?? []).map((r: { task_id: string }) => r.task_id)
    const createdIds = (createdRes.data ?? []).map((r: { id: string }) => r.id)
    const allIds = [...new Set([...assignedIds, ...createdIds])]
    if (allIds.length === 0) {
      return <EmptyAnalytics role={role} name={profile.full_name} />
    }
    taskQuery = taskQuery.in('id', allIds)
  }

  const now = new Date().toISOString()
  const [tasksRes, usersRes] = await Promise.all([
    taskQuery,
    isOrgWide
      ? supabase.from('profiles').select('id').eq('org_id', orgId).eq('is_active', true)
      : isDeptLevel && deptId
        ? supabase.from('profiles').select('id').eq('dept_id', deptId).eq('is_active', true)
        : Promise.resolve({ data: [{ id: user.id }] }),
  ])

  type TaskRow = { id: string; status: string; priority: string; due_date: string | null; created_at: string; created_by: string; dept_id: string | null; team_id: string | null }
  const allTasks = (tasksRes.data ?? []) as TaskRow[]
  const activeUsers = (usersRes.data ?? []).length

  const taskStats = {
    total: allTasks.length,
    todo: allTasks.filter(t => t.status === 'todo').length,
    in_progress: allTasks.filter(t => t.status === 'in_progress').length,
    in_review: allTasks.filter(t => t.status === 'in_review').length,
    done: allTasks.filter(t => t.status === 'done').length,
    cancelled: allTasks.filter(t => t.status === 'cancelled').length,
    overdue: allTasks.filter(t => t.due_date && t.due_date < now && t.status !== 'done' && t.status !== 'cancelled').length,
    urgent: allTasks.filter(t => t.priority === 'urgent').length,
    high: allTasks.filter(t => t.priority === 'high').length,
  }

  const completionRate = taskStats.total > 0
    ? Math.round((taskStats.done / taskStats.total) * 100)
    : 0

  const priorityCounts: Record<string, number> = {}
  for (const t of allTasks) {
    priorityCounts[t.priority] = (priorityCounts[t.priority] ?? 0) + 1
  }

  // Last 14 days trend
  const days14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return d.toISOString().slice(0, 10)
  })
  const trend = days14.map(day => ({
    day,
    created: allTasks.filter(t => t.created_at.slice(0, 10) === day).length,
    completed: allTasks.filter(t => t.status === 'done' && t.created_at.slice(0, 10) === day).length,
  }))

  // Recent tasks (last 8)
  const recentTasks = [...allTasks]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8)
    .map(t => ({ id: t.id, title: t.id, status: t.status, created_at: t.created_at }))

  const scopeLabel = isOrgWide
    ? 'Organisation-wide'
    : isDeptLevel
      ? 'Your Department'
      : 'Your Tasks'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">{scopeLabel} · {profile.full_name}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks', value: taskStats.total, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Completion Rate', value: `${completionRate}%`, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Overdue', value: taskStats.overdue, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'In Progress', value: taskStats.in_progress, color: 'text-blue-600', bg: 'bg-blue-50' },
          ...(isOrgWide || isDeptLevel ? [{ label: 'Active Users', value: activeUsers, color: 'text-purple-600', bg: 'bg-purple-50' }] : []),
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Task Status Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'To Do', count: taskStats.todo, color: 'bg-gray-400' },
            { label: 'In Progress', count: taskStats.in_progress, color: 'bg-blue-500' },
            { label: 'In Review', count: taskStats.in_review, color: 'bg-amber-500' },
            { label: 'Done', count: taskStats.done, color: 'bg-green-500' },
            { label: 'Cancelled', count: taskStats.cancelled, color: 'bg-gray-200' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 p-3 rounded-lg bg-gray-50">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.color}`} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-lg font-bold text-gray-900">{s.count}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Priority breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Priority Distribution</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Urgent', key: 'urgent', color: 'text-red-600 bg-red-50' },
            { label: 'High', key: 'high', color: 'text-orange-600 bg-orange-50' },
            { label: 'Medium', key: 'medium', color: 'text-blue-600 bg-blue-50' },
            { label: 'Low', key: 'low', color: 'text-gray-600 bg-gray-50' },
          ].map(p => (
            <div key={p.key} className={`flex items-center justify-between p-3 rounded-lg ${p.color}`}>
              <span className="text-sm font-medium">{p.label}</span>
              <span className="text-xl font-bold">{priorityCounts[p.key] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 14-day trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">14-Day Activity Trend</h2>
        <div className="flex items-end gap-1 h-24">
          {trend.map((t, i) => {
            const max = Math.max(...trend.map(x => x.created), 1)
            const pct = Math.round((t.created / max) * 100)
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className="w-full bg-indigo-400 rounded-t transition-all"
                  style={{ height: `${pct}%`, minHeight: t.created > 0 ? '4px' : '0' }}
                  title={`${t.day}: ${t.created} created`}
                />
                {i % 3 === 0 && (
                  <span className="text-[9px] text-gray-400">{t.day.slice(5)}</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-400" />Created per day</span>
        </div>
      </div>

      {isOrgWide && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-700">
          For full analytics with charts, team breakdowns, and inspection reports, visit{' '}
          <a href="/admin/analytics" className="font-semibold underline hover:text-indigo-900">Admin Analytics</a>.
        </div>
      )}
    </div>
  )
}

function EmptyAnalytics({ role, name }: { role: string; name: string }) {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
      <p className="text-sm text-gray-500 mt-0.5">Your Tasks · {name}</p>
      <div className="mt-8 text-center text-gray-400">
        <p className="text-lg">No tasks found yet.</p>
        <p className="text-sm mt-1">Tasks you create or are assigned to will appear here.</p>
      </div>
    </div>
  )
}
