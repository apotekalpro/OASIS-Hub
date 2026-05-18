import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasRole } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'
import { InspectionAnalyticsDashboard } from '@/components/analytics/inspection-analytics-dashboard'
import { AtemAnalyticsDashboard } from '@/components/analytics/atem-analytics-dashboard'
import { OkrAnalyticsDashboard } from '@/components/analytics/okr-analytics-dashboard'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; dept_filter?: string; user_filter?: string; outlet_filter?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profileRes = await supabase
    .from('profiles')
    .select('org_id, role, dept_id, full_name')
    .eq('id', user.id)
    .single()

  const profile = profileRes.data as {
    org_id: string | null; role: UserRole; dept_id: string | null; full_name: string
  } | null
  if (!profile) redirect('/login')

  const { org_id: orgId, role, dept_id: deptId, full_name } = profile
  const isOrgWide = hasRole(role, 'org_admin')
  const isDeptLevel = !isOrgWide && hasRole(role, 'dept_head')

  const { tab: tabParam, dept_filter: deptFilter, user_filter: userFilter, outlet_filter: outletFilter } = await searchParams
  const tab = tabParam ?? 'tasks'

  // Fetch filter options (departments, users, outlets) for org-wide views
  type FilterDept = { id: string; name: string }
  type FilterUser = { id: string; full_name: string }
  type FilterOutlet = { id: string; name: string; code: string }

  let filterDepts: FilterDept[] = []
  let filterUsers: FilterUser[] = []
  let filterOutlets: FilterOutlet[] = []

  if ((isOrgWide || isDeptLevel) && orgId) {
    const [deptsRes, usersRes, outletsRes] = await Promise.all([
      supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
      supabase.from('profiles').select('id, full_name').eq('org_id', orgId).eq('is_active', true).order('full_name'),
      supabase.from('outlets').select('id, name, code').eq('org_id', orgId).order('name'),
    ])
    filterDepts = (deptsRes.data ?? []) as FilterDept[]
    filterUsers = (usersRes.data ?? []) as FilterUser[]
    filterOutlets = (outletsRes.data ?? []) as FilterOutlet[]
  }

  const filterOptions = (isOrgWide || isDeptLevel)
    ? { departments: filterDepts, users: filterUsers, outlets: filterOutlets }
    : undefined

  // ── ATEM tab ──────────────────────────────────────────────────────────────
  if (tab === 'atem' && orgId) {
    let atemQuery = supabase.from('atem_items')
      .select('id, status, priority, deadline, created_at, dept_id, departments(name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (deptFilter) atemQuery = atemQuery.eq('dept_id', deptFilter)

    const itemsRes = await atemQuery
    type AtemRow = { id: string; status: string; priority: string; deadline: string | null; created_at: string; dept_id: string | null; departments?: { name: string } | { name: string }[] | null }
    let items = (itemsRes.data ?? []) as unknown as AtemRow[]

    // Filter by user (assignee)
    if (userFilter) {
      const assigneesRes = await supabase.from('atem_assignees').select('atem_id').eq('user_id', userFilter)
      const assignedIds = new Set((assigneesRes.data ?? []).map((a: { atem_id: string }) => a.atem_id))
      items = items.filter(i => assignedIds.has(i.id))
    }

    const now = new Date().toISOString()
    const atemStats = {
      total: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      in_progress: items.filter(i => i.status === 'in_progress').length,
      completed: items.filter(i => i.status === 'completed').length,
      blocked: items.filter(i => i.status === 'blocked').length,
      overdue: items.filter(i => i.deadline && i.deadline < now && i.status !== 'completed').length,
      urgent: items.filter(i => i.priority === 'urgent').length,
      high: items.filter(i => i.priority === 'high').length,
    }
    const deptBreakdown = Object.values(
      items.reduce<Record<string, { name: string; total: number; completed: number }>>((acc, i) => {
        const key = i.dept_id ?? 'none'
        const depts = i.departments
        const name = (Array.isArray(depts) ? depts[0]?.name : depts?.name) ?? 'No Department'
        if (!acc[key]) acc[key] = { name, total: 0, completed: 0 }
        acc[key].total++
        if (i.status === 'completed') acc[key].completed++
        return acc
      }, {})
    )
    return (
      <AtemAnalyticsDashboard
        stats={atemStats}
        deptBreakdown={deptBreakdown}
        items={items.slice(0, 10).map(i => ({ id: i.id, status: i.status, priority: i.priority, deadline: i.deadline, created_at: i.created_at }))}
        scopeLabel={isOrgWide ? 'Organisation-wide' : 'Your ATEM'}
        filterOptions={filterOptions}
      />
    )
  }

  // ── OKR tab ───────────────────────────────────────────────────────────────
  if (tab === 'okr' && orgId) {
    let objQuery = supabase.from('okr_objectives')
      .select('id, status, progress, period_type, dept_id, departments(name), created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (deptFilter) objQuery = objQuery.eq('dept_id', deptFilter)

    const objRes = await objQuery
    type OkrRow = { id: string; status: string; progress: number; period_type: string; dept_id: string | null; departments?: { name: string } | { name: string }[] | null; created_at: string }
    let objs = (objRes.data ?? []) as unknown as OkrRow[]

    // Filter by user (assignee)
    if (userFilter) {
      const assigneesRes = await supabase.from('okr_assignees').select('objective_id').eq('user_id', userFilter)
      const assignedIds = new Set((assigneesRes.data ?? []).map((a: { objective_id: string }) => a.objective_id))
      objs = objs.filter(o => assignedIds.has(o.id))
    }

    const objIds = objs.map(o => o.id)
    const krRes = objIds.length > 0
      ? await supabase.from('okr_key_results').select('id, objective_id, status, current_value, target_value, metric_type').in('objective_id', objIds)
      : { data: [] }

    type KrRow = { id: string; objective_id: string; status: string; current_value: number; target_value: number; metric_type: string }
    const krs = (krRes.data ?? []) as KrRow[]
    const okrStats = {
      total: objs.length,
      on_track: objs.filter(o => o.status === 'on_track').length,
      at_risk: objs.filter(o => o.status === 'at_risk').length,
      behind: objs.filter(o => o.status === 'behind').length,
      completed: objs.filter(o => o.status === 'completed').length,
      cancelled: objs.filter(o => o.status === 'cancelled').length,
      avg_progress: objs.length > 0 ? Math.round(objs.reduce((s, o) => s + o.progress, 0) / objs.length) : 0,
      total_krs: krs.length,
      completed_krs: krs.filter(k => k.status === 'completed').length,
    }
    const deptBreakdown = Object.values(
      objs.reduce<Record<string, { name: string; total: number; completed: number; avg_progress: number; items: number }>>((acc, o) => {
        const key = o.dept_id ?? 'none'
        const depts = o.departments
        const name = (Array.isArray(depts) ? depts[0]?.name : depts?.name) ?? 'No Department'
        if (!acc[key]) acc[key] = { name, total: 0, completed: 0, avg_progress: 0, items: 0 }
        acc[key].total++
        acc[key].items++
        acc[key].avg_progress = (acc[key].avg_progress * (acc[key].items - 1) + o.progress) / acc[key].items
        if (o.status === 'completed') acc[key].completed++
        return acc
      }, {})
    ).map(d => ({ ...d, avg_progress: Math.round(d.avg_progress) }))
    return (
      <OkrAnalyticsDashboard
        stats={okrStats}
        deptBreakdown={deptBreakdown}
        scopeLabel={isOrgWide ? 'Organisation-wide' : 'Your OKRs'}
        filterOptions={filterOptions}
      />
    )
  }

  // ── Inspections tab (org-wide RPCs, only for admins) ──────────────────────
  if (tab === 'inspections' && isOrgWide && orgId) {
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
        outletFilter
          ? supabase.from('inspection_issues').select('status').eq('org_id', orgId).eq('outlet_id', outletFilter)
          : supabase.from('inspection_issues').select('status').eq('org_id', orgId),
      ])

    type SeverityRow = { severity: string; total: number; open_count: number; resolved_count: number }
    type OutletStat = { outlet_id: string; outlet_name: string; outlet_code: string; total_issues: number; open_issues: number; resolved_issues: number; total_sessions: number; completed_sessions: number; completion_rate: number; irr: number }
    type TrendRow = { day: string; opened: number; resolved: number; escalated: number; in_progress: number }
    type SessionTrendRow = { day: string; scheduled: number; completed: number; missed: number }
    type UserStat = { user_id: string; full_name: string; avatar_url: string; sessions_conducted: number; sessions_completed: number; issues_raised: number; issues_resolved: number; completion_rate: number }
    type IssueStatusRow = { status: string }

    const allIssues = (issueCountsRes.data as IssueStatusRow[]) ?? []
    const issueCounts = {
      total: allIssues.length,
      open: allIssues.filter(i => i.status === 'open').length,
      in_progress: allIssues.filter(i => i.status === 'in_progress').length,
      escalated: allIssues.filter(i => i.status === 'escalated').length,
      resolved: allIssues.filter(i => i.status === 'resolved').length,
      closed: allIssues.filter(i => i.status === 'closed').length,
    }
    const avgResolutionHours = Number(avgResRes.data ?? 0)

    return (
      <InspectionAnalyticsDashboard
        irr={Number(irrRes.data ?? 0)}
        rcr={Number(rcrRes.data ?? 0)}
        severity={(severityRes.data as SeverityRow[]) ?? []}
        outletStats={(outletStatsRes.data as OutletStat[]) ?? []}
        issueTrend={(issueTrendRes.data as TrendRow[]) ?? []}
        sessionTrend={(sessionTrendRes.data as SessionTrendRow[]) ?? []}
        avgResolutionHours={Math.floor(avgResolutionHours)}
        avgResolutionMins={Math.round((avgResolutionHours - Math.floor(avgResolutionHours)) * 60)}
        userStats={(userStatsRes.data as UserStat[]) ?? []}
        issueCounts={issueCounts}
        filterOptions={filterOptions}
      />
    )
  }

  // ── Tasks tab: org admin / super admin — use RPCs ─────────────────────────
  if (isOrgWide && orgId) {
    // For user/dept filtered tasks, use direct queries instead of RPCs
    if (deptFilter || userFilter) {
      const now = new Date().toISOString()
      let taskQuery = supabase.from('tasks')
        .select('id, title, status, priority, due_date, created_at, created_by, dept_id, team_id')
        .eq('org_id', orgId)
        .is('parent_id', null)
        .is('kr_id', null)
        .order('created_at', { ascending: false })

      if (deptFilter) taskQuery = taskQuery.eq('dept_id', deptFilter)

      const tasksRes = await taskQuery
      type TaskRowFull = { id: string; title: string; status: string; priority: string; due_date: string | null; created_at: string; created_by: string; dept_id: string | null; team_id: string | null }
      let allTasks = (tasksRes.data ?? []) as TaskRowFull[]

      if (userFilter) {
        const assigneesRes = await supabase.from('task_assignees').select('task_id').eq('user_id', userFilter)
        const assignedIds = new Set((assigneesRes.data ?? []).map((a: { task_id: string }) => a.task_id))
        allTasks = allTasks.filter(t => assignedIds.has(t.id) || t.created_by === userFilter)
      }

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
      const completionRate = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0
      const priorityCounts = allTasks
        .filter(t => t.status !== 'done' && t.status !== 'cancelled')
        .reduce<Record<string, number>>((acc, t) => { acc[t.priority] = (acc[t.priority] ?? 0) + 1; return acc }, {})

      const days30 = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (29 - i))
        return d.toISOString().slice(0, 10)
      })
      const trend = days30.map(day => ({
        day,
        created: allTasks.filter(t => t.created_at.slice(0, 10) === day).length,
        completed: allTasks.filter(t => t.status === 'done' && t.created_at.slice(0, 10) === day).length,
      }))

      // Team stats from filtered tasks
      const teamIds = [...new Set(allTasks.map(t => t.team_id).filter(Boolean))] as string[]
      const teamsRes = teamIds.length > 0 ? await supabase.from('teams').select('id, name').in('id', teamIds) : { data: [] }
      const teams = (teamsRes.data ?? []) as { id: string; name: string }[]
      const teamStats = teams.map(team => {
        const tTasks = allTasks.filter(t => t.team_id === team.id)
        return {
          team_id: team.id,
          team_name: team.name,
          total: tTasks.length,
          done: tTasks.filter(t => t.status === 'done').length,
          overdue: tTasks.filter(t => t.due_date && t.due_date < now && t.status !== 'done' && t.status !== 'cancelled').length,
        }
      })

      // Contributors from filtered tasks
      const taskIds = allTasks.map(t => t.id)
      const assigneeRows = taskIds.length > 0
        ? (await supabase.from('task_assignees').select('task_id, user_id').in('task_id', taskIds)).data ?? []
        : []
      const assigneeMap = (assigneeRows as { task_id: string; user_id: string }[])
      const uniqueUserIds = [...new Set(assigneeMap.map(a => a.user_id))]
      const profilesRes = uniqueUserIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', uniqueUserIds)
        : { data: [] }
      const profiles = (profilesRes.data ?? []) as { id: string; full_name: string; avatar_url: string | null }[]
      const contributors = profiles.map(p => {
        const myTaskIds = assigneeMap.filter(a => a.user_id === p.id).map(a => a.task_id)
        const myTasks = allTasks.filter(t => myTaskIds.includes(t.id) || t.created_by === p.id)
        return {
          user_id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          completed: myTasks.filter(t => t.status === 'done').length,
          in_progress: myTasks.filter(t => t.status === 'in_progress' || t.status === 'todo').length,
        }
      }).filter(c => c.completed + c.in_progress > 0).sort((a, b) => b.completed - a.completed).slice(0, 8)

      return (
        <AnalyticsDashboard
          taskStats={taskStats}
          trend={trend}
          teamStats={teamStats}
          contributors={contributors}
          formDeptStats={[]}
          activeUsers={uniqueUserIds.length}
          priorityCounts={priorityCounts}
          recentTasks={allTasks.slice(0, 10).map(t => ({ id: t.id, title: t.title, status: t.status, created_at: t.created_at }))}
          completionRate={completionRate}
          scopeLabel="Organisation-wide performance overview"
          filterOptions={filterOptions}
        />
      )
    }

    // No filters — use efficient RPCs
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
      supabase.from('tasks').select('priority').eq('org_id', orgId).not('status', 'in', '("done","cancelled")').is('parent_id', null).is('kr_id', null),
      supabase.from('tasks').select('id, title, status, created_at').eq('org_id', orgId).is('parent_id', null).is('kr_id', null).order('created_at', { ascending: false }).limit(10),
    ])

    type TaskStats = { total: number; todo: number; in_progress: number; in_review: number; done: number; cancelled: number; overdue: number; urgent: number; high: number }
    type TrendRow2 = { day: string; completed: number; created: number }
    type TeamStat = { team_id: string; team_name: string; total: number; done: number; overdue: number }
    type Contributor = { user_id: string; full_name: string; avatar_url: string | null; completed: number; in_progress: number }
    type FormDeptStat = { dept_name: string; total: number; approved: number; rejected: number; avg_score: number | null }
    type RecentTask = { id: string; title: string; status: string; created_at: string }
    type PriorityRow = { priority: string }

    const taskStats = (taskStatsRes.data as TaskStats | null) ?? { total: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, cancelled: 0, overdue: 0, urgent: 0, high: 0 }
    const priorityCounts = ((tasksByPriorityRes.data as PriorityRow[]) ?? []).reduce<Record<string, number>>((acc, t) => {
      acc[t.priority] = (acc[t.priority] ?? 0) + 1; return acc
    }, {})
    const completionRate = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0

    return (
      <AnalyticsDashboard
        taskStats={taskStats}
        trend={(trendRes.data as TrendRow2[]) ?? []}
        teamStats={(teamStatsRes.data as TeamStat[]) ?? []}
        contributors={(contributorsRes.data as Contributor[]) ?? []}
        formDeptStats={(formStatsDeptRes.data as FormDeptStat[]) ?? []}
        activeUsers={activeUsersRes.count ?? 0}
        priorityCounts={priorityCounts}
        recentTasks={(recentActivityRes.data as RecentTask[]) ?? []}
        completionRate={completionRate}
        scopeLabel="Organisation-wide performance overview"
        filterOptions={filterOptions}
      />
    )
  }

  // ── Tasks tab: dept_head — dept-scoped direct queries ──────────────────────
  if (isDeptLevel && deptId) {
    const now = new Date().toISOString()

    let taskQuery = supabase.from('tasks')
      .select('id, title, status, priority, due_date, created_at, created_by')
      .eq('dept_id', deptId)
      .is('parent_id', null)
      .is('kr_id', null)
      .order('created_at', { ascending: false })

    const [tasksRes, membersRes, teamsRes] = await Promise.all([
      taskQuery,
      supabase.from('profiles').select('id, full_name, avatar_url').eq('dept_id', deptId).eq('is_active', true),
      supabase.from('teams').select('id, name').eq('dept_id', deptId),
    ])

    type TaskRow = { id: string; title: string; status: string; priority: string; due_date: string | null; created_at: string; created_by: string }
    type MemberRow = { id: string; full_name: string; avatar_url: string | null }

    let allTasks = (tasksRes.data ?? []) as TaskRow[]
    const members = (membersRes.data ?? []) as MemberRow[]

    // For contributor stats, fetch task_assignees for these tasks
    const taskIds = allTasks.map(t => t.id)
    const assigneesForDept = taskIds.length > 0
      ? await supabase.from('task_assignees').select('task_id, user_id').in('task_id', taskIds)
      : { data: [] }
    let assigneeRows = (assigneesForDept.data ?? []) as { task_id: string; user_id: string }[]

    // Apply user filter
    if (userFilter) {
      const assignedIds = new Set(assigneeRows.filter(a => a.user_id === userFilter).map(a => a.task_id))
      allTasks = allTasks.filter(t => assignedIds.has(t.id) || t.created_by === userFilter)
      assigneeRows = assigneeRows.filter(a => allTasks.some(t => t.id === a.task_id))
    }

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

    const completionRate = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0

    const priorityCounts = allTasks
      .filter(t => t.status !== 'done' && t.status !== 'cancelled')
      .reduce<Record<string, number>>((acc, t) => { acc[t.priority] = (acc[t.priority] ?? 0) + 1; return acc }, {})

    // 30-day trend
    const days30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i))
      return d.toISOString().slice(0, 10)
    })
    const trend = days30.map(day => ({
      day,
      created: allTasks.filter(t => t.created_at.slice(0, 10) === day).length,
      completed: allTasks.filter(t => t.status === 'done' && t.created_at.slice(0, 10) === day).length,
    }))

    // Contributors: dept members with task stats
    const contributors = members
      .map(m => {
        const myTaskIds = assigneeRows.filter(a => a.user_id === m.id).map(a => a.task_id)
        const myTasks = allTasks.filter(t => myTaskIds.includes(t.id) || t.created_by === m.id)
        return {
          user_id: m.id,
          full_name: m.full_name,
          avatar_url: m.avatar_url,
          completed: myTasks.filter(t => t.status === 'done').length,
          in_progress: myTasks.filter(t => t.status === 'in_progress' || t.status === 'todo').length,
        }
      })
      .filter(c => c.completed + c.in_progress > 0)
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 8)

    // Team stats for dept teams
    const deptTeams = (teamsRes.data ?? []) as { id: string; name: string }[]
    const teamTaskMap = await (deptTeams.length > 0
      ? supabase.from('tasks').select('id, team_id, status, due_date').in('team_id', deptTeams.map(t => t.id)).is('parent_id', null).is('kr_id', null)
      : Promise.resolve({ data: [] }))
    const teamTaskRows = (teamTaskMap.data ?? []) as { id: string; team_id: string; status: string; due_date: string | null }[]
    const teamStats = deptTeams.map(team => {
      const tTasks = teamTaskRows.filter(t => t.team_id === team.id)
      return {
        team_id: team.id,
        team_name: team.name,
        total: tTasks.length,
        done: tTasks.filter(t => t.status === 'done').length,
        overdue: tTasks.filter(t => t.due_date && t.due_date < now && t.status !== 'done' && t.status !== 'cancelled').length,
      }
    })

    // Dept name
    const deptRes = await supabase.from('departments').select('name').eq('id', deptId).single()
    const deptName = deptRes.data?.name ?? 'Your Department'

    return (
      <AnalyticsDashboard
        taskStats={taskStats}
        trend={trend}
        teamStats={teamStats}
        contributors={contributors}
        formDeptStats={[]}
        activeUsers={members.length}
        priorityCounts={priorityCounts}
        recentTasks={allTasks.slice(0, 10).map(t => ({ id: t.id, title: t.title, status: t.status, created_at: t.created_at }))}
        completionRate={completionRate}
        scopeLabel={`${deptName} · Department view`}
        filterOptions={filterOptions}
      />
    )
  }

  // ── Tasks tab: member / team_leader / auditor — personal tasks only ────────
  const now = new Date().toISOString()
  const [assignedRes, createdRes] = await Promise.all([
    supabase.from('task_assignees').select('task_id').eq('user_id', user.id),
    supabase.from('tasks').select('id').eq('created_by', user.id),
  ])
  const assignedIds = (assignedRes.data ?? []).map((r: { task_id: string }) => r.task_id)
  const createdIds = (createdRes.data ?? []).map((r: { id: string }) => r.id)
  const allIds = [...new Set([...assignedIds, ...createdIds])]

  if (allIds.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your Tasks · {full_name}</p>
        <div className="mt-8 text-center text-gray-400 py-20">
          <p className="text-lg">No tasks found yet.</p>
          <p className="text-sm mt-1">Tasks you create or are assigned to will appear here.</p>
        </div>
      </div>
    )
  }

  const [tasksRes] = await Promise.all([
    supabase.from('tasks')
      .select('id, title, status, priority, due_date, created_at')
      .in('id', allIds)
      .is('parent_id', null)
      .is('kr_id', null)
      .order('created_at', { ascending: false }),
  ])

  type TaskRow = { id: string; title: string; status: string; priority: string; due_date: string | null; created_at: string }
  const allTasks = (tasksRes.data ?? []) as TaskRow[]

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
  const completionRate = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0
  const priorityCounts = allTasks
    .filter(t => t.status !== 'done' && t.status !== 'cancelled')
    .reduce<Record<string, number>>((acc, t) => { acc[t.priority] = (acc[t.priority] ?? 0) + 1; return acc }, {})

  const days30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i))
    return d.toISOString().slice(0, 10)
  })
  const trend = days30.map(day => ({
    day,
    created: allTasks.filter(t => t.created_at.slice(0, 10) === day).length,
    completed: allTasks.filter(t => t.status === 'done' && t.created_at.slice(0, 10) === day).length,
  }))

  return (
    <AnalyticsDashboard
      taskStats={taskStats}
      trend={trend}
      teamStats={[]}
      contributors={[]}
      formDeptStats={[]}
      activeUsers={1}
      priorityCounts={priorityCounts}
      recentTasks={allTasks.slice(0, 10).map(t => ({ id: t.id, title: t.title, status: t.status, created_at: t.created_at }))}
      completionRate={completionRate}
      scopeLabel={`Your Tasks · ${full_name}`}
    />
  )
}
