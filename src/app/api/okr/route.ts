import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { okrAssignedEmail } from '@/lib/email/templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? 'https://oasishub.netlify.app'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = profile.data?.org_id
  if (!orgId) return NextResponse.json({ objectives: [] })

  const { data, error } = await admin.from('okr_objectives')
    .select('*, departments(name), teams(name), okr_key_results(id, title, metric_type, start_value, target_value, current_value, unit, status, due_date), okr_assignees(user_id, role), okr_watchers(user_id)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ objectives: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('org_id, full_name').eq('id', user.id).single()
  const orgId = profile.data?.org_id
  const actorName = profile.data?.full_name ?? 'Someone'
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const body = await req.json()
  const { assigneeIds = [], watcherIds = [], keyResults = [], ...fields } = body

  const { data: obj, error } = await admin.from('okr_objectives').insert({
    org_id: orgId,
    created_by: user.id,
    title: fields.title,
    description: fields.description || null,
    period_type: fields.period_type || 'quarterly',
    period_label: fields.period_label || null,
    start_date: fields.start_date || null,
    end_date: fields.end_date || null,
    status: fields.status || 'on_track',
    dept_id: fields.dept_id || null,
    team_id: fields.team_id || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert key results, then create any subtasks linked to each KR
  if (keyResults.length > 0) {
    const { data: insertedKrs } = await admin.from('okr_key_results').insert(
      keyResults.map((kr: Record<string, unknown>) => {
        const { subtasks: _s, ...krFields } = kr as Record<string, unknown>
        return { ...krFields, objective_id: obj.id }
      })
    ).select('id')

    for (let i = 0; i < keyResults.length; i++) {
      const subtasks = ((keyResults[i] as Record<string, unknown>).subtasks as Array<{ title: string; priority?: string }>) ?? []
      const krId = insertedKrs?.[i]?.id
      if (krId && subtasks.length > 0) {
        await admin.from('tasks').insert(
          subtasks.filter(s => s.title?.trim()).map(s => ({
            title: s.title.trim(),
            priority: s.priority || 'medium',
            status: 'todo',
            org_id: orgId,
            created_by: user.id,
            kr_id: krId,
            is_okr_subtask: true,
          }))
        )
      }
    }
  }

  // Insert assignees — creator is always owner
  const allAssignees = assigneeIds.includes(user.id)
    ? assigneeIds
    : [user.id, ...assigneeIds]

  if (allAssignees.length > 0) {
    await admin.from('okr_assignees').insert(
      allAssignees.map((uid: string) => ({
        objective_id: obj.id,
        user_id: uid,
        role: uid === user.id && !assigneeIds.includes(user.id) ? 'owner' : 'contributor',
      }))
    )
  }

  if (watcherIds.length > 0) {
    await admin.from('okr_watchers').insert(
      watcherIds.map((uid: string) => ({ objective_id: obj.id, user_id: uid }))
    )
  }

  // Fire-and-forget email to assignees (excluding creator)
  const notifyIds = (assigneeIds as string[]).filter((uid: string) => uid !== user.id)
  if (notifyIds.length > 0) {
    const { data: recipients } = await admin
      .from('profiles').select('id, full_name, email, contact_email').in('id', notifyIds)
    const okrUrl = `${APP_URL}/okr/${obj.id}`
    const dueDate = obj.end_date
      ? new Date(obj.end_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
      : undefined
    ;(recipients ?? []).filter(r => r.email).forEach(r => {
      const tpl = okrAssignedEmail({ recipientName: r.full_name, objectiveTitle: obj.title, assignedBy: actorName, dueDate, okrUrl })
      sendEmail({ to: r.contact_email || r.email, subject: tpl.subject, html: tpl.html }).catch(() => {})
    })
  }

  return NextResponse.json({ objective: obj }, { status: 201 })
}
