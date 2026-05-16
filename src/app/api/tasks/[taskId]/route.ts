import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const body = await request.json()
  const { assigneeIds, watcherIds, ...taskPayload } = body

  const { error } = await admin.from('tasks').update(taskPayload).eq('id', taskId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (Array.isArray(assigneeIds)) {
    await admin.from('task_assignees').delete().eq('task_id', taskId)
    if ((assigneeIds as string[]).length > 0) {
      await admin.from('task_assignees').insert(
        (assigneeIds as string[]).map((uid: string) => ({ task_id: taskId, user_id: uid, assigned_by: user.id }))
      )
    }
  }

  if (Array.isArray(watcherIds)) {
    await admin.from('task_watchers').delete().eq('task_id', taskId)
    if ((watcherIds as string[]).length > 0) {
      await admin.from('task_watchers').insert(
        (watcherIds as string[]).map((uid: string) => ({ task_id: taskId, user_id: uid, added_by: user.id }))
      )
    }
  }

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
