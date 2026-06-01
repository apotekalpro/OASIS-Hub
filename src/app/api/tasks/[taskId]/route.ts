import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const supabase = await createClient()
  const [{ data: { user } }, body] = await Promise.all([
    supabase.auth.getUser(),
    request.json(),
  ])
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { assigneeIds, watcherIds, ...taskPayload } = body

  // Phase 1: update + delete old assignees/watchers in parallel
  const [updateResult] = await Promise.all([
    admin.from('tasks').update(taskPayload).eq('id', taskId),
    Array.isArray(assigneeIds)
      ? admin.from('task_assignees').delete().eq('task_id', taskId)
      : Promise.resolve(null),
    Array.isArray(watcherIds)
      ? admin.from('task_watchers').delete().eq('task_id', taskId)
      : Promise.resolve(null),
  ])
  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 })

  // Phase 2: insert new assignees/watchers in parallel
  await Promise.all([
    Array.isArray(assigneeIds) && assigneeIds.length > 0
      ? admin.from('task_assignees').insert(
          (assigneeIds as string[]).map((uid: string) => ({ task_id: taskId, user_id: uid, assigned_by: user.id }))
        )
      : Promise.resolve(null),
    Array.isArray(watcherIds) && watcherIds.length > 0
      ? admin.from('task_watchers').insert(
          (watcherIds as string[]).map((uid: string) => ({ task_id: taskId, user_id: uid, added_by: user.id }))
        )
      : Promise.resolve(null),
  ])

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin.from('tasks').delete().eq('id', taskId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
