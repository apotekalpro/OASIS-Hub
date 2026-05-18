import { createClient } from '@/lib/supabase/server'
import { CalendarClient } from '@/components/calendar/calendar-client'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id, full_name').eq('id', user.id).single()
  const orgId = (profileRes.data as { org_id: string } | null)?.org_id ?? ''

  // Stage 1: events + user data + due-date access checks (all independent)
  const [
    eventsRes, usersRes, teamsRes, deptsRes,
    taskAssigneeRes, taskWatcherRes,
    okrAssigneeRes, okrWatcherRes, okrCreatedRes,
    atemAssigneeRes, atemWatcherRes, atemCreatedRes,
  ] = await Promise.all([
    supabase.from('events').select(`
      id, title, description, location, start_at, end_at, is_all_day,
      team_id, dept_id, created_by,
      teams(name, color),
      event_attendees(user_id, rsvp)
    `).eq('org_id', orgId).order('start_at'),
    supabase.from('profiles').select('id, full_name, email, avatar_url').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    supabase.from('teams').select('id, name, color').eq('org_id', orgId).order('name'),
    supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
    supabase.from('task_assignees').select('task_id').eq('user_id', user.id),
    supabase.from('task_watchers').select('task_id').eq('user_id', user.id),
    supabase.from('okr_assignees').select('objective_id').eq('user_id', user.id),
    supabase.from('okr_watchers').select('objective_id').eq('user_id', user.id),
    supabase.from('okr_objectives').select('id').eq('created_by', user.id).eq('org_id', orgId),
    supabase.from('atem_assignees').select('atem_id').eq('user_id', user.id),
    supabase.from('atem_watchers').select('atem_id').eq('user_id', user.id),
    supabase.from('atem_items').select('id').eq('created_by', user.id).eq('org_id', orgId),
  ])

  // Compute accessible IDs
  const taskIds = [...new Set([
    ...((taskAssigneeRes.data ?? []) as { task_id: string }[]).map(r => r.task_id),
    ...((taskWatcherRes.data ?? []) as { task_id: string }[]).map(r => r.task_id),
  ])]
  const objIds = [...new Set([
    ...((okrAssigneeRes.data ?? []) as { objective_id: string }[]).map(r => r.objective_id),
    ...((okrWatcherRes.data ?? []) as { objective_id: string }[]).map(r => r.objective_id),
    ...((okrCreatedRes.data ?? []) as { id: string }[]).map(r => r.id),
  ])]
  const atemIds = [...new Set([
    ...((atemAssigneeRes.data ?? []) as { atem_id: string }[]).map(r => r.atem_id),
    ...((atemWatcherRes.data ?? []) as { atem_id: string }[]).map(r => r.atem_id),
    ...((atemCreatedRes.data ?? []) as { id: string }[]).map(r => r.id),
  ])]

  // Build task OR filter
  const taskOrParts = [`created_by.eq.${user.id}`]
  if (taskIds.length > 0) taskOrParts.push(`id.in.(${taskIds.join(',')})`)

  // Stage 2: due-date queries (parallel)
  const [taskDueRes, krDueRes, atemDueRes] = await Promise.all([
    supabase.from('tasks')
      .select('id, title, due_date, status')
      .not('due_date', 'is', null)
      .is('parent_id', null)
      .is('kr_id', null)
      .eq('org_id', orgId)
      .or(taskOrParts.join(',')),
    objIds.length > 0
      ? supabase.from('okr_key_results')
          .select('id, title, due_date, status, objective_id')
          .not('due_date', 'is', null)
          .in('objective_id', objIds)
      : Promise.resolve({ data: [] as unknown[] }),
    atemIds.length > 0
      ? supabase.from('atem_items')
          .select('id, title, deadline, status')
          .not('deadline', 'is', null)
          .in('id', atemIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  type RawEvent = {
    id: string; title: string; description: string | null; location: string | null
    start_at: string; end_at: string; is_all_day: boolean
    team_id: string | null; dept_id: string | null; created_by: string
    teams?: { name: string; color: string } | null
    event_attendees?: Array<{ user_id: string; rsvp: string }>
  }
  type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
  type DueItem = { id: string; title: string; date: string; type: 'task' | 'kr' | 'atem'; status: string; link: string }

  const dueItems: DueItem[] = [
    ...((taskDueRes.data ?? []) as { id: string; title: string; due_date: string; status: string }[]).map(t => ({
      id: t.id, title: t.title, date: t.due_date, type: 'task' as const, status: t.status, link: `/tasks/${t.id}`,
    })),
    ...((krDueRes.data ?? []) as { id: string; title: string; due_date: string; status: string; objective_id: string }[]).map(kr => ({
      id: kr.id, title: kr.title, date: kr.due_date, type: 'kr' as const, status: kr.status, link: `/okr/${kr.objective_id}`,
    })),
    ...((atemDueRes.data ?? []) as { id: string; title: string; deadline: string; status: string }[]).map(a => ({
      id: a.id, title: a.title, date: a.deadline, type: 'atem' as const, status: a.status, link: `/atem`,
    })),
  ]

  const events = (eventsRes.data as unknown as RawEvent[]) ?? []
  const users = (usersRes.data as OrgUser[]) ?? []
  const teams = (teamsRes.data as Array<{ id: string; name: string; color: string }>) ?? []
  const depts = (deptsRes.data as Array<{ id: string; name: string }>) ?? []

  return (
    <CalendarClient
      initialEvents={events}
      dueItems={dueItems}
      orgId={orgId}
      currentUserId={user.id}
      users={users}
      teams={teams}
      departments={depts}
    />
  )
}
