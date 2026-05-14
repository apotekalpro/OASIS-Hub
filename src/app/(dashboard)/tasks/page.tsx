import { createClient } from '@/lib/supabase/server'
import { TasksClient } from '@/components/tasks/tasks-client'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id, full_name').eq('id', user.id).single()
  const orgId = (profileRes.data as { org_id: string; full_name: string } | null)?.org_id ?? ''

  const [tasksRes, usersRes, teamsRes, deptsRes] = await Promise.all([
    supabase.from('tasks').select(`
      id, title, description, status, priority, due_date, tags, created_at, created_by,
      task_assignees(
        user_id,
        profiles(id, full_name, avatar_url)
      )
    `).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email, avatar_url').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    supabase.from('teams').select('id, name').eq('org_id', orgId).order('name'),
    supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
  ])

  type RawAssignee = {
    user_id: string
    profiles?: { id: string; full_name: string; avatar_url: string | null } | null
  }
  type RawTask = {
    id: string; title: string; description: string | null; status: string; priority: string
    due_date: string | null; tags: string[]; created_at: string; created_by: string
    task_assignees?: RawAssignee[]
  }

  const rawTasks = tasksRes.data as unknown as RawTask[]

  const tasks = (rawTasks ?? []).map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    tags: t.tags ?? [],
    created_at: t.created_at,
    assignees: (t.task_assignees ?? [])
      .map(a => a.profiles ? { id: a.profiles.id, full_name: a.profiles.full_name, avatar_url: a.profiles.avatar_url } : null)
      .filter(Boolean) as Array<{ id: string; full_name: string; avatar_url: string | null }>,
  }))

  type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
  const users = usersRes.data as OrgUser[] | null
  const teams = teamsRes.data as Array<{ id: string; name: string }> | null
  const depts = deptsRes.data as Array<{ id: string; name: string }> | null

  return (
    <TasksClient
      initialTasks={tasks}
      orgId={orgId}
      currentUserId={user.id}
      users={users ?? []}
      teams={teams ?? []}
      departments={depts ?? []}
    />
  )
}
