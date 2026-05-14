import { createClient } from '@/lib/supabase/server'
import { TasksClient } from '@/components/tasks/tasks-client'
import { hasRole } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase
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

  if (isSuperAdmin || (isAdmin && orgId)) {
    // Admins: fetch all org tasks directly
    const query = supabase.from('tasks').select(taskSelect).order('created_at', { ascending: false })
    if (!isSuperAdmin && orgId) query.eq('org_id', orgId)
    const res = await query
    rawTasks = (res.data as unknown as RawTask[]) ?? []
  } else {
    // Step 1: task IDs assigned to this user
    const assignedRes = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', user.id)
    const assignedIds = ((assignedRes.data ?? []) as Array<{ task_id: string }>).map(r => r.task_id)

    // Step 2: tasks created by me OR assigned to me
    const orParts: string[] = [`created_by.eq.${user.id}`]
    if (assignedIds.length > 0) orParts.push(`id.in.(${assignedIds.join(',')})`)

    const res = await supabase.from('tasks')
      .select(taskSelect)
      .or(orParts.join(','))
      .order('created_at', { ascending: false })
    rawTasks = (res.data as unknown as RawTask[]) ?? []
  }

  // Fetch org users to resolve assignee profiles (no nested join needed)
  const [usersRes, teamsRes, deptsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, avatar_url')
      .eq('org_id', orgId).eq('is_active', true).order('full_name'),
    supabase.from('teams').select('id, name').eq('org_id', orgId).order('name'),
    supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
  ])

  type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
  const userMap = new Map<string, OrgUser>(
    ((usersRes.data as OrgUser[]) ?? []).map(u => [u.id, u])
  )

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
    }))

  return (
    <TasksClient
      initialTasks={tasks}
      orgId={orgId}
      currentUserId={user.id}
      currentUserRole={profile?.role ?? 'member'}
      users={(usersRes.data as OrgUser[]) ?? []}
      teams={(teamsRes.data as Array<{ id: string; name: string }>) ?? []}
      departments={(deptsRes.data as Array<{ id: string; name: string }>) ?? []}
    />
  )
}
