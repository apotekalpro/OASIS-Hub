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
  const isAdmin = hasRole(profile?.role ?? 'member', 'org_admin')

  type RawAssignee = {
    user_id: string
    profiles?: { id: string; full_name: string; avatar_url: string | null } | null
  }
  type RawTask = {
    id: string; title: string; description: string | null; status: string; priority: string
    due_date: string | null; tags: string[] | null; created_at: string; created_by: string
    task_assignees?: RawAssignee[]
  }

  const taskSelect = `
    id, title, description, status, priority, due_date, tags, created_at, created_by,
    task_assignees(user_id, profiles(id, full_name, avatar_url))
  `

  // Always fetch tasks assigned to me and created by me (works regardless of org_id)
  const [assignedRes, createdRes] = await Promise.all([
    supabase.from('tasks')
      .select(taskSelect.replace('task_assignees(', 'task_assignees!inner('))
      .eq('task_assignees.user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('tasks')
      .select(taskSelect)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false }),
  ])

  // For admins with a valid org_id, also fetch all org tasks
  let orgTasksRaw: RawTask[] = []
  if (isAdmin && orgId) {
    const orgRes = await supabase.from('tasks')
      .select(taskSelect)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
    orgTasksRaw = (orgRes.data as unknown as RawTask[]) ?? []
  }

  // Merge + deduplicate
  const seenIds = new Set<string>()
  const allRaw = [
    ...((assignedRes.data as unknown as RawTask[]) ?? []),
    ...((createdRes.data as unknown as RawTask[]) ?? []),
    ...orgTasksRaw,
  ].filter(t => {
    if (seenIds.has(t.id)) return false
    seenIds.add(t.id)
    return true
  }).sort((a, b) => b.created_at.localeCompare(a.created_at))

  const tasks = allRaw.map(t => ({
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
      .map(a => a.profiles
        ? { id: a.profiles.id, full_name: a.profiles.full_name, avatar_url: a.profiles.avatar_url }
        : null)
      .filter(Boolean) as Array<{ id: string; full_name: string; avatar_url: string | null }>,
  }))

  const [usersRes, teamsRes, deptsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, avatar_url')
      .eq('org_id', orgId).eq('is_active', true).order('full_name'),
    supabase.from('teams').select('id, name').eq('org_id', orgId).order('name'),
    supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
  ])

  type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }

  return (
    <TasksClient
      initialTasks={tasks}
      orgId={orgId}
      currentUserId={user.id}
      users={(usersRes.data as OrgUser[]) ?? []}
      teams={(teamsRes.data as Array<{ id: string; name: string }>) ?? []}
      departments={(deptsRes.data as Array<{ id: string; name: string }>) ?? []}
    />
  )
}
