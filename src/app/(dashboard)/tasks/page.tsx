import { createClient, createAdminClient } from '@/lib/supabase/server'
import { TasksClient } from '@/components/tasks/tasks-client'
import { hasRole } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await admin
    .from('profiles')
    .select('org_id, full_name, role')
    .eq('id', user.id)
    .single()

  const profile = profileRes.data as { org_id: string | null; full_name: string; role: UserRole } | null
  const orgId = profile?.org_id ?? ''
  const isSuperAdmin = profile?.role === 'super_admin'
  const isAdmin = hasRole(profile?.role ?? 'member', 'org_admin')

  // Simple task shape — no nested profiles, avoids 3-level join issues
  type RawTask = {
    id: string; title: string; description: string | null; status: string; priority: string
    due_date: string | null; tags: string[] | null; created_at: string; created_by: string
    task_assignees?: Array<{ user_id: string }>
  }

  // taskSelect without nested profiles — profiles come from usersRes below
  const taskSelect = `id, title, description, status, priority, due_date, tags, created_at, created_by, task_assignees(user_id)`

  let rawTasks: RawTask[] = []
  let watcherTaskIds: string[] = []
  let usersRes, teamsRes, deptsRes

  if (isSuperAdmin || (isAdmin && orgId)) {
    // Admins: fetch tasks + supporting data all in parallel (exclude subtasks)
    const tasksQuery = supabase.from('tasks').select(taskSelect).is('parent_id', null).is('kr_id', null).order('created_at', { ascending: false })
    if (!isSuperAdmin && orgId) tasksQuery.eq('org_id', orgId)

    const [tasksResult, ...rest] = await Promise.all([
      tasksQuery,
      supabase.from('profiles').select('id, full_name, email, avatar_url, dept_id, role').eq('org_id', orgId).eq('is_active', true).order('full_name'),
      admin.from('teams').select('id, name, team_members(user_id, profiles(id, full_name, email, avatar_url, dept_id, role))').eq('org_id', orgId).order('name'),
      supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
    ])
    rawTasks = (tasksResult.data as unknown as RawTask[]) ?? [];
    [usersRes, teamsRes, deptsRes] = rest
  } else {
    // Members: fetch assignees + watchers + supporting data in parallel, then tasks
    const [assignedRes, watcherRes, ...rest] = await Promise.all([
      supabase.from('task_assignees').select('task_id').eq('user_id', user.id),
      supabase.from('task_watchers').select('task_id').eq('user_id', user.id),
      supabase.from('profiles').select('id, full_name, email, avatar_url, dept_id, role').eq('org_id', orgId).eq('is_active', true).order('full_name'),
      admin.from('teams').select('id, name, team_members(user_id, profiles(id, full_name, email, avatar_url, dept_id, role))').eq('org_id', orgId).order('name'),
      supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
    ])
    ;[usersRes, teamsRes, deptsRes] = rest

    const assignedIds = ((assignedRes.data ?? []) as Array<{ task_id: string }>).map(r => r.task_id)
    watcherTaskIds = ((watcherRes.data ?? []) as Array<{ task_id: string }>).map(r => r.task_id)

    const orParts: string[] = [`created_by.eq.${user.id}`]
    if (assignedIds.length > 0) orParts.push(`id.in.(${assignedIds.join(',')})`)
    if (watcherTaskIds.length > 0) orParts.push(`id.in.(${watcherTaskIds.join(',')})`)

    const res = await supabase.from('tasks')
      .select(taskSelect)
      .is('parent_id', null)
      .is('kr_id', null)
      .or(orParts.join(','))
      .order('created_at', { ascending: false })
    rawTasks = (res.data as unknown as RawTask[]) ?? []
  }

  type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null; dept_id?: string | null; role?: string | null }
  const userMap = new Map<string, OrgUser>(
    ((usersRes.data as OrgUser[]) ?? []).map(u => [u.id, u])
  )

  // Fetch subtask counts
  const taskIds = rawTasks.map(t => t.id)
  let subtaskCounts: Record<string, { total: number; done: number }> = {}
  if (taskIds.length > 0) {
    const { data: subtaskData } = await supabase
      .from('tasks')
      .select('parent_id, status')
      .in('parent_id', taskIds)
    for (const s of (subtaskData ?? []) as Array<{ parent_id: string; status: string }>) {
      if (!subtaskCounts[s.parent_id]) subtaskCounts[s.parent_id] = { total: 0, done: 0 }
      subtaskCounts[s.parent_id].total++
      if (s.status === 'done') subtaskCounts[s.parent_id].done++
    }
  }

  // Deduplicate and map
  const seenIds = new Set<string>()
  const tasks = rawTasks
    .filter(t => { if (seenIds.has(t.id)) return false; seenIds.add(t.id); return true })
    .map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      tags: t.tags ?? [],
      created_at: t.created_at,
      created_by: t.created_by,
      assignees: (t.task_assignees ?? [])
        .map(a => userMap.get(a.user_id) ?? null)
        .filter((u): u is OrgUser => u !== null)
        .map(u => ({ id: u.id, full_name: u.full_name, avatar_url: u.avatar_url })),
      _subtaskCount: subtaskCounts[t.id]?.total ?? 0,
      _subtaskDone: subtaskCounts[t.id]?.done ?? 0,
      isWatcher: watcherTaskIds.includes(t.id) && t.created_by !== user.id && !(t.task_assignees ?? []).some(a => a.user_id === user.id),
    }))

  return (
    <TasksClient
      initialTasks={tasks}
      orgId={orgId}
      currentUserId={user.id}
      users={(usersRes.data as OrgUser[]) ?? []}
      teams={(teamsRes.data as unknown as Array<{ id: string; name: string; team_members?: Array<{ user_id: string; profiles?: OrgUser | null }> }>) ?? []}
      departments={(deptsRes.data as Array<{ id: string; name: string }>) ?? []}
    />
  )
}
