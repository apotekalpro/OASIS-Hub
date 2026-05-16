import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TaskDetailClient } from '@/components/tasks/task-detail-client'

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id, full_name, avatar_url, role').eq('id', user.id).single()
  const orgId = (profileRes.data as { org_id: string } | null)?.org_id ?? ''
  const currentUser = profileRes.data as { org_id: string; full_name: string; avatar_url: string | null; role: string } | null

  const admin = createAdminClient()
  const [taskRes, commentsRes, timeLogsRes, subtasksRes, assigneeIdsRes, watcherIdsRes, usersRes, teamsRes, deptsRes] = await Promise.all([
    supabase.from('tasks').select(`
      id, title, description, status, priority, due_date, start_date, estimated_hours,
      tags, created_at, created_by, team_id, dept_id, org_id
    `).eq('id', taskId).single(),
    supabase.from('task_comments').select(`
      id, content, created_at, parent_comment_id, attachments,
      profiles(id, full_name, avatar_url)
    `).eq('task_id', taskId).order('created_at', { ascending: true }),
    supabase.from('task_time_logs').select(`
      id, hours, description, logged_at,
      profiles(id, full_name, avatar_url)
    `).eq('task_id', taskId).order('logged_at', { ascending: false }),
    supabase.from('tasks').select('id, title, status, priority').eq('parent_id', taskId).order('created_at'),
    admin.from('task_assignees').select('user_id').eq('task_id', taskId),
    admin.from('task_watchers').select('user_id').eq('task_id', taskId),
    admin.from('profiles').select('id, full_name, email, avatar_url').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    admin.from('teams').select('id, name').eq('org_id', orgId).order('name'),
    admin.from('departments').select('id, name').eq('org_id', orgId).order('name'),
  ])

  // Two-step fetch for assignee/watcher profiles to avoid FK join issues
  const assigneeIds = ((assigneeIdsRes.data ?? []) as Array<{ user_id: string }>).map(a => a.user_id)
  const watcherIds = ((watcherIdsRes.data ?? []) as Array<{ user_id: string }>).map(w => w.user_id)
  const [assigneeProfilesRes, watcherProfilesRes] = await Promise.all([
    assigneeIds.length > 0
      ? admin.from('profiles').select('id, full_name, avatar_url, email').in('id', assigneeIds)
      : Promise.resolve({ data: [] }),
    watcherIds.length > 0
      ? admin.from('profiles').select('id, full_name, avatar_url, email').in('id', watcherIds)
      : Promise.resolve({ data: [] }),
  ])

  if (!taskRes.data) return notFound()

  type RawTask = {
    id: string; title: string; description: string | null; status: string; priority: string
    due_date: string | null; start_date: string | null; estimated_hours: number | null
    tags: string[]; created_at: string; created_by: string; team_id: string | null; dept_id: string | null; org_id: string
    teams?: { name: string } | null; departments?: { name: string } | null
  }
  type RawComment = { id: string; content: string; created_at: string; parent_comment_id: string | null; attachments: Array<{ name: string; url: string; type: 'image' | 'file' }> | null; profiles?: { id: string; full_name: string; avatar_url: string | null } | null }
  type RawTimeLog = { id: string; hours: number; description: string | null; logged_at: string; profiles?: { id: string; full_name: string; avatar_url: string | null } | null }
  type RawSubtask = { id: string; title: string; status: string; priority: string }
  type ProfileRow = { id: string; full_name: string; avatar_url: string | null; email: string }
  type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }

  const task = taskRes.data as unknown as RawTask
  const comments = (commentsRes.data as unknown as RawComment[]) ?? []
  const timeLogs = (timeLogsRes.data as unknown as RawTimeLog[]) ?? []
  const subtasks = (subtasksRes.data as unknown as RawSubtask[]) ?? []
  const assignees = (assigneeProfilesRes.data as ProfileRow[]) ?? []
  const watchers = (watcherProfilesRes.data as ProfileRow[]) ?? []
  const users = (usersRes.data as OrgUser[]) ?? []

  return (
    <TaskDetailClient
      task={task}
      comments={comments.map(c => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        parent_comment_id: c.parent_comment_id,
        attachments: c.attachments ?? [],
        reactions: [],
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
      assignees={assignees}
      watchers={watchers}
      orgId={orgId}
      currentUserId={user.id}
      currentUserName={currentUser?.full_name ?? 'You'}
      currentUserAvatar={currentUser?.avatar_url ?? null}
      currentUserRole={currentUser?.role ?? 'member'}
      users={users}
      teams={(teamsRes.data as Array<{ id: string; name: string }>) ?? []}
      departments={(deptsRes.data as Array<{ id: string; name: string }>) ?? []}
    />
  )
}
