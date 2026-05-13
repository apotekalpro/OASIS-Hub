import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TaskDetailClient } from '@/components/tasks/task-detail-client'

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id, full_name, avatar_url').eq('id', user.id).single()
  const orgId = (profileRes.data as { org_id: string } | null)?.org_id ?? ''
  const currentUser = profileRes.data as { org_id: string; full_name: string; avatar_url: string | null } | null

  const [taskRes, commentsRes, timeLogsRes, subtasksRes, assigneesRes, usersRes, teamsRes, deptsRes] = await Promise.all([
    supabase.from('tasks').select(`
      id, title, description, status, priority, due_date, start_date, estimated_hours,
      tags, created_at, created_by, team_id, dept_id, org_id,
      teams(name), departments(name)
    `).eq('id', taskId).single(),
    supabase.from('task_comments').select(`
      id, content, created_at,
      profiles(id, full_name, avatar_url)
    `).eq('task_id', taskId).order('created_at', { ascending: true }),
    supabase.from('task_time_logs').select(`
      id, hours, description, logged_at,
      profiles(id, full_name, avatar_url)
    `).eq('task_id', taskId).order('logged_at', { ascending: false }),
    supabase.from('tasks').select('id, title, status, priority').eq('parent_id', taskId).order('created_at'),
    supabase.from('task_assignees').select(`
      user_id,
      profiles(id, full_name, avatar_url, email)
    `).eq('task_id', taskId),
    supabase.from('profiles').select('id, full_name, email, avatar_url').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    supabase.from('teams').select('id, name').eq('org_id', orgId).order('name'),
    supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
  ])

  if (!taskRes.data) return notFound()

  type RawTask = {
    id: string; title: string; description: string | null; status: string; priority: string
    due_date: string | null; start_date: string | null; estimated_hours: number | null
    tags: string[]; created_at: string; created_by: string; team_id: string | null; dept_id: string | null; org_id: string
    teams?: { name: string } | null; departments?: { name: string } | null
  }
  type RawComment = { id: string; content: string; created_at: string; profiles?: { id: string; full_name: string; avatar_url: string | null } | null }
  type RawTimeLog = { id: string; hours: number; description: string | null; logged_at: string; profiles?: { id: string; full_name: string; avatar_url: string | null } | null }
  type RawSubtask = { id: string; title: string; status: string; priority: string }
  type RawAssignee = { user_id: string; profiles?: { id: string; full_name: string; avatar_url: string | null; email: string } | null }
  type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }

  const task = taskRes.data as unknown as RawTask
  const comments = (commentsRes.data as unknown as RawComment[]) ?? []
  const timeLogs = (timeLogsRes.data as unknown as RawTimeLog[]) ?? []
  const subtasks = (subtasksRes.data as unknown as RawSubtask[]) ?? []
  const assignees = (assigneesRes.data as unknown as RawAssignee[]) ?? []
  const users = (usersRes.data as OrgUser[]) ?? []

  return (
    <TaskDetailClient
      task={task}
      comments={comments.map(c => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user: c.profiles ? { id: c.profiles.id, full_name: c.profiles.full_name, avatar_url: c.profiles.avatar_url } : { id: '', full_name: 'Unknown', avatar_url: null },
      }))}
      timeLogs={timeLogs.map(l => ({
        id: l.id,
        hours: l.hours,
        description: l.description,
        logged_at: l.logged_at,
        user: l.profiles ? { id: l.profiles.id, full_name: l.profiles.full_name, avatar_url: l.profiles.avatar_url } : { id: '', full_name: 'Unknown', avatar_url: null },
      }))}
      subtasks={subtasks}
      assignees={assignees.map(a => a.profiles ? { id: a.profiles.id, full_name: a.profiles.full_name, avatar_url: a.profiles.avatar_url, email: a.profiles.email } : null).filter(Boolean) as Array<{ id: string; full_name: string; avatar_url: string | null; email: string }>}
      orgId={orgId}
      currentUserId={user.id}
      currentUserName={currentUser?.full_name ?? 'You'}
      currentUserAvatar={currentUser?.avatar_url ?? null}
      users={users}
      teams={(teamsRes.data as Array<{ id: string; name: string }>) ?? []}
      departments={(deptsRes.data as Array<{ id: string; name: string }>) ?? []}
    />
  )
}
