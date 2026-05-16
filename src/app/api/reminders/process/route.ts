import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { taskDueSoonEmail } from '@/lib/email/templates'

// POST /api/reminders/process
// Called by a cron job (e.g., Netlify scheduled function, Vercel cron, or external service)
// Secured via CRON_SECRET header
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createAdminClient()

  // Process due reminders
  const { data: reminders } = await supabase
    .from('reminders')
    .select('*, profiles(email, full_name, notification_preferences)')
    .eq('is_active', true)
    .eq('is_sent', false)
    .lte('remind_at', new Date().toISOString())
    .limit(100)

  let processed = 0

  for (const reminder of reminders ?? []) {
    // Create in-app notification
    await supabase.from('notifications').insert({
      user_id: reminder.user_id,
      type: 'system',
      title: reminder.title,
      body: reminder.body,
      data: { reminder_id: reminder.id, ref_type: reminder.ref_type, ref_id: reminder.ref_id },
    })

    // Optionally send email
    const profile = (reminder as { profiles?: { email: string; full_name: string } }).profiles
    if (profile?.email && reminder.ref_type === 'task' && reminder.ref_id) {
      const { data: task } = await supabase
        .from('tasks')
        .select('title, due_date')
        .eq('id', reminder.ref_id)
        .single()

      if (task) {
        const email = taskDueSoonEmail({
          recipientName: profile.full_name,
          taskTitle: task.title,
          dueDate: task.due_date ? new Date(task.due_date).toLocaleDateString('en-MY') : 'No due date',
          taskUrl: `${process.env.NEXT_PUBLIC_APP_URL}/tasks/${reminder.ref_id}`,
        })
        await sendEmail({ to: profile.email, ...email })
      }
    }

    // Update reminder state
    if (reminder.frequency === 'once') {
      await supabase.from('reminders').update({ is_sent: true }).eq('id', reminder.id)
    } else {
      const nextRemindAt = getNextRemindAt(reminder.remind_at, reminder.frequency)
      const shouldDeactivate = reminder.recurrence_end && nextRemindAt > reminder.recurrence_end

      await supabase.from('reminders').update({
        remind_at: nextRemindAt,
        is_active: !shouldDeactivate,
      }).eq('id', reminder.id)
    }

    processed++
  }

  // Process overdue tasks — notify assignees
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select(`
      id, title, due_date,
      task_assignees(user_id, profiles(email, full_name))
    `)
    .not('status', 'in', '("done","cancelled")')
    .lt('due_date', new Date().toISOString())
    .gt('due_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  for (const task of overdueTasks ?? []) {
    for (const assignee of (task as { task_assignees?: { user_id: string }[] }).task_assignees ?? []) {
      // Only insert if not already notified today
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', assignee.user_id)
        .eq('type', 'task_overdue')
        .contains('data', { task_id: task.id })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      if (!count) {
        await supabase.from('notifications').insert({
          user_id: assignee.user_id,
          type: 'task_overdue',
          title: `Task overdue: ${task.title}`,
          body: `Due: ${new Date(task.due_date!).toLocaleDateString('en-MY')}`,
          data: { task_id: task.id },
        })
      }
    }
  }

  return NextResponse.json({ success: true, processed })
}

function getNextRemindAt(current: string, frequency: string): string {
  const date = new Date(current)
  switch (frequency) {
    case 'daily': date.setDate(date.getDate() + 1); break
    case 'weekly': date.setDate(date.getDate() + 7); break
    case 'monthly': date.setMonth(date.getMonth() + 1); break
  }
  return date.toISOString()
}
