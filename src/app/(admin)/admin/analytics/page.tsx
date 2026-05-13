import { createClient } from '@/lib/supabase/server'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = (profileRes.data as { org_id: string } | null)?.org_id ?? ''

  // Fetch all analytics data in parallel
  const [
    taskStatsRes,
    trendRes,
    teamStatsRes,
    contributorsRes,
    formStatsDeptRes,
    activeUsersRes,
    tasksByPriorityRes,
    recentActivityRes,
  ] = await Promise.all([
    supabase.rpc('get_org_task_stats', { p_org_id: orgId }),
    supabase.rpc('get_task_completion_trend', { p_org_id: orgId, p_days: 30 }),
    supabase.rpc('get_team_task_stats', { p_org_id: orgId }),
    supabase.rpc('get_top_contributors', { p_org_id: orgId, p_limit: 8 }),
    supabase.rpc('get_form_stats_by_dept', { p_org_id: orgId }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true),
    supabase.from('tasks').select('priority').eq('org_id', orgId).not('status', 'in', '("done","cancelled")'),
    supabase.from('tasks').select('id, title, status, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(10),
  ])

  type TaskStats = { total: number; todo: number; in_progress: number; in_review: number; done: number; cancelled: number; overdue: number; urgent: number; high: number }
  type TrendRow = { day: string; completed: number; created: number }
  type TeamStat = { team_id: string; team_name: string; total: number; done: number; overdue: number }
  type Contributor = { user_id: string; full_name: string; avatar_url: string | null; completed: number; in_progress: number }
  type FormDeptStat = { dept_name: string; total: number; approved: number; rejected: number; avg_score: number | null }

  const taskStats = (taskStatsRes.data as TaskStats | null) ?? { total: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, cancelled: 0, overdue: 0, urgent: 0, high: 0 }
  const trend = (trendRes.data as TrendRow[]) ?? []
  const teamStats = (teamStatsRes.data as TeamStat[]) ?? []
  const contributors = (contributorsRes.data as Contributor[]) ?? []
  const formDeptStats = (formStatsDeptRes.data as FormDeptStat[]) ?? []
  const activeUsers = activeUsersRes.count ?? 0

  type PriorityRow = { priority: string }
  const priorityCounts = ((tasksByPriorityRes.data as PriorityRow[]) ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t.priority] = (acc[t.priority] ?? 0) + 1
    return acc
  }, {})

  type RecentTask = { id: string; title: string; status: string; created_at: string }
  const recentTasks = (recentActivityRes.data as RecentTask[]) ?? []

  const completionRate = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0

  return (
    <AnalyticsDashboard
      taskStats={taskStats}
      trend={trend}
      teamStats={teamStats}
      contributors={contributors}
      formDeptStats={formDeptStats}
      activeUsers={activeUsers}
      priorityCounts={priorityCounts}
      recentTasks={recentTasks}
      completionRate={completionRate}
    />
  )
}
