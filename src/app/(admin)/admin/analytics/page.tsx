import { createClient } from '@/lib/supabase/server'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'
import { InspectionAnalyticsDashboard } from '@/components/analytics/inspection-analytics-dashboard'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = (profileRes.data as { org_id: string } | null)?.org_id ?? ''

  const { tab: tabParam } = await searchParams
  const tab = tabParam ?? 'tasks'

  if (tab === 'inspections') {
    const [irrRes, rcrRes, severityRes, outletStatsRes, issueTrendRes, sessionTrendRes, avgResRes, userStatsRes, issueCountsRes] =
      await Promise.all([
        supabase.rpc('get_inspection_irr', { p_org_id: orgId }),
        supabase.rpc('get_inspection_rcr', { p_org_id: orgId }),
        supabase.rpc('get_issues_by_severity', { p_org_id: orgId }),
        supabase.rpc('get_outlet_issue_stats', { p_org_id: orgId, p_limit: 10 }),
        supabase.rpc('get_issue_trend', { p_org_id: orgId, p_days: 14 }),
        supabase.rpc('get_session_trend', { p_org_id: orgId, p_days: 14 }),
        supabase.rpc('get_avg_resolution_hours', { p_org_id: orgId }),
        supabase.rpc('get_user_inspection_stats', { p_org_id: orgId, p_limit: 10 }),
        supabase.from('inspection_issues').select('status').eq('org_id', orgId),
      ])

    type SeverityRow = { severity: string; total: number; open_count: number; resolved_count: number }
    type OutletStat = { outlet_id: string; outlet_name: string; outlet_code: string; total_issues: number; open_issues: number; resolved_issues: number; total_sessions: number; completed_sessions: number; completion_rate: number; irr: number }
    type TrendRow = { day: string; opened: number; resolved: number; escalated: number; in_progress: number }
    type SessionTrendRow = { day: string; scheduled: number; completed: number; missed: number }
    type UserStat = { user_id: string; full_name: string; avatar_url: string; sessions_conducted: number; sessions_completed: number; issues_raised: number; issues_resolved: number; completion_rate: number }
    type IssueStatusRow = { status: string }

    const irr = Number(irrRes.data ?? 0)
    const rcr = Number(rcrRes.data ?? 0)
    const severity = (severityRes.data as SeverityRow[]) ?? []
    const outletStats = (outletStatsRes.data as OutletStat[]) ?? []
    const issueTrend = (issueTrendRes.data as TrendRow[]) ?? []
    const sessionTrend = (sessionTrendRes.data as SessionTrendRow[]) ?? []
    const avgResolutionHours = Number(avgResRes.data ?? 0)
    const userStats = (userStatsRes.data as UserStat[]) ?? []

    const allIssues = (issueCountsRes.data as IssueStatusRow[]) ?? []
    const issueCounts = {
      total: allIssues.length,
      open: allIssues.filter(i => i.status === 'open').length,
      in_progress: allIssues.filter(i => i.status === 'in_progress').length,
      escalated: allIssues.filter(i => i.status === 'escalated').length,
      resolved: allIssues.filter(i => i.status === 'resolved').length,
      closed: allIssues.filter(i => i.status === 'closed').length,
    }

    const avgHours = Math.floor(avgResolutionHours)
    const avgMins = Math.round((avgResolutionHours - avgHours) * 60)

    return (
      <InspectionAnalyticsDashboard
        irr={irr}
        rcr={rcr}
        severity={severity}
        outletStats={outletStats}
        issueTrend={issueTrend}
        sessionTrend={sessionTrend}
        avgResolutionHours={avgHours}
        avgResolutionMins={avgMins}
        userStats={userStats}
        issueCounts={issueCounts}
      />
    )
  }

  // Task analytics (existing)
  const [
    taskStatsRes, trendRes, teamStatsRes, contributorsRes,
    formStatsDeptRes, activeUsersRes, tasksByPriorityRes, recentActivityRes,
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
  type TrendRow2 = { day: string; completed: number; created: number }
  type TeamStat = { team_id: string; team_name: string; total: number; done: number; overdue: number }
  type Contributor = { user_id: string; full_name: string; avatar_url: string | null; completed: number; in_progress: number }
  type FormDeptStat = { dept_name: string; total: number; approved: number; rejected: number; avg_score: number | null }
  type RecentTask = { id: string; title: string; status: string; created_at: string }

  const taskStats = (taskStatsRes.data as TaskStats | null) ?? { total: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, cancelled: 0, overdue: 0, urgent: 0, high: 0 }
  const trend = (trendRes.data as TrendRow2[]) ?? []
  const teamStats = (teamStatsRes.data as TeamStat[]) ?? []
  const contributors = (contributorsRes.data as Contributor[]) ?? []
  const formDeptStats = (formStatsDeptRes.data as FormDeptStat[]) ?? []
  const activeUsers = activeUsersRes.count ?? 0
  type PriorityRow = { priority: string }
  const priorityCounts = ((tasksByPriorityRes.data as PriorityRow[]) ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t.priority] = (acc[t.priority] ?? 0) + 1; return acc
  }, {})
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
