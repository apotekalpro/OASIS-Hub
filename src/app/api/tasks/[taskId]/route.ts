import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { taskCompletedEmail } from '@/lib/email/templates'
import { canEditDeadline } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? 'https://oasishub.netlify.app'

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

  // Deadline (due_date) may only be changed by the task owner or dept_head+
  if ('due_date' in taskPayload) {
    const [{ data: existingTask }, { data: profile }] = await Promise.all([
      admin.from('tasks').select('due_date, created_by').eq('id', taskId).single(),
      admin.from('profiles').select('role').eq('id', user.id).single(),
    ])
    const dueDateChanged = (existingTask?.due_date ?? null) !== (taskPayload.due_date ?? null)
    if (dueDateChanged && existingTask && !canEditDeadline(user.id, (profile?.role ?? 'member') as UserRole, existingTask.created_by)) {
      return NextResponse.json({ error: 'Only the task owner or an admin can change the due date' }, { status: 403 })
    }
  }

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

  // Fire-and-forget: notify all PICs and CCs when task is marked complete
  if (taskPayload.status === 'done') {
    Promise.resolve(
      Promise.all([
        admin.from('profiles').select('full_name').eq('id', user.id).single(),
        admin.from('tasks').select('title').eq('id', taskId).single(),
        admin.from('task_assignees').select('user_id').eq('task_id', taskId),
        admin.from('task_watchers').select('user_id').eq('task_id', taskId),
      ])
    ).then(([actorRes, taskRes, assigneesRes, watchersRes]) => {
      const actorName = actorRes.data?.full_name ?? 'Someone'
      const taskTitle = taskRes.data?.title ?? 'A task'
      const taskUrl = `${APP_URL}/tasks/${taskId}`

      const recipientIds = [...new Set([
        ...((assigneesRes.data ?? []) as { user_id: string }[]).map(a => a.user_id),
        ...((watchersRes.data ?? []) as { user_id: string }[]).map(w => w.user_id),
      ])].filter(uid => uid !== user.id)

      if (!recipientIds.length) return

      // In-app notifications
      Promise.resolve(
        admin.from('notifications').insert(
          recipientIds.map(uid => ({
            user_id: uid,
            type: 'task_completed',
            title: `${actorName} completed: ${taskTitle}`,
            body: null,
            data: { task_id: taskId, url: taskUrl },
          }))
        )
      ).catch(() => {})

      // Email notifications
      Promise.resolve(
        admin.from('profiles').select('id, full_name, email, contact_email').in('id', recipientIds)
      ).then(({ data: recipients }) => {
        for (const r of (recipients ?? []) as { id: string; full_name: string; email: string; contact_email: string | null }[]) {
          const to = r.contact_email || r.email
          if (!to) continue
          const tpl = taskCompletedEmail({ recipientName: r.full_name, taskTitle, completedBy: actorName, taskUrl })
          sendEmail({ to, subject: tpl.subject, html: tpl.html }).catch(() => {})
        }
      }).catch(() => {})
    }).catch(() => {})
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
