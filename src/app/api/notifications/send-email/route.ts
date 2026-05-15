import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { taskAssignedEmail } from '@/lib/email/templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? 'https://oasishub.netlify.app'

// POST /api/notifications/send-email
// Body: { type: 'task_assigned' | 'task_mention', taskId, userIds, actorName }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, taskId, userIds, actorName } = body as {
    type: 'task_assigned' | 'task_mention'
    taskId: string
    userIds: string[]
    actorName: string
  }

  if (!taskId || !userIds?.length) return NextResponse.json({ ok: true })

  const [taskRes, usersRes] = await Promise.all([
    supabase.from('tasks').select('id, title, due_date').eq('id', taskId).single(),
    supabase.from('profiles').select('id, full_name, email, contact_email').in('id', userIds),
  ])

  const task = taskRes.data
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const recipients = usersRes.data ?? []
  const taskUrl = `${APP_URL}/tasks/${taskId}`
  const dueDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
    : undefined

  const results = await Promise.allSettled(
    recipients
      .filter(r => r.email && r.id !== user.id)
      .map(r => {
        const deliveryEmail = r.contact_email || r.email
        const tpl = type === 'task_assigned'
          ? taskAssignedEmail({ recipientName: r.full_name, taskTitle: task.title, assignedBy: actorName, dueDate, taskUrl })
          : taskMentionEmail({ recipientName: r.full_name, taskTitle: task.title, mentionedBy: actorName, taskUrl })
        return sendEmail({ to: deliveryEmail, subject: tpl.subject, html: tpl.html })
      })
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ sent, total: recipients.length })
}

function taskMentionEmail(params: { recipientName: string; taskTitle: string; mentionedBy: string; taskUrl: string }) {
  return {
    subject: `[OASIS Hub] ${params.mentionedBy} mentioned you in "${params.taskTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#6366f1;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">OASIS Hub</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
          <p>Hi <strong>${params.recipientName}</strong>,</p>
          <p><strong>${params.mentionedBy}</strong> mentioned you in a task comment.</p>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
            <h3 style="margin:0;color:#111827">${params.taskTitle}</h3>
          </div>
          <a href="${params.taskUrl}" style="display:inline-block;background:#6366f1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
            View Task
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">OASIS Hub — Internal Management System</p>
        </div>
      </div>
    `,
  }
}
