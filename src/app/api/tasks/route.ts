import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const body = await request.json()
  const { assigneeIds = [], watcherIds = [], notifyUserIds = [], actorName = '', ...taskPayload } = body

  const { data: created, error } = await admin
    .from('tasks')
    .insert({ ...taskPayload, created_by: user.id })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const taskId = (created as { id: string }).id

  // Insert assignees — default to creator if none provided
  const assignees = (assigneeIds as string[]).length > 0
    ? (assigneeIds as string[]).map((uid: string) => ({ task_id: taskId, user_id: uid, assigned_by: user.id }))
    : [{ task_id: taskId, user_id: user.id, assigned_by: user.id }]

  const [assignErr] = await Promise.all([
    admin.from('task_assignees').insert(assignees).then(r => r.error),
    (watcherIds as string[]).length > 0
      ? admin.from('task_watchers').insert(
          (watcherIds as string[]).map((uid: string) => ({ task_id: taskId, user_id: uid, added_by: user.id }))
        ).then(r => r.error)
      : Promise.resolve(null),
  ])

  if (assignErr) return NextResponse.json({ error: assignErr.message }, { status: 500 })

  // Fire-and-forget email notifications
  if ((notifyUserIds as string[]).length > 0) {
    fetch('/api/notifications/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'task_assigned', taskId, userIds: notifyUserIds, actorName }),
    }).catch(() => {})
  }

  return NextResponse.json({ id: taskId })
}
