import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { atemAssignedEmail } from '@/lib/email/templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? 'https://oasishub.netlify.app'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('org_id, role').eq('id', user.id).single()
  const orgId = profile.data?.org_id
  if (!orgId) return NextResponse.json({ items: [] })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')

  let q = admin.from('atem_items')
    .select('*, departments(name), teams(name), atem_assignees(user_id), atem_watchers(user_id)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)
  if (priority) q = q.eq('priority', priority)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()

  // Parse body and verify auth in parallel
  const [{ data: { user } }, body] = await Promise.all([
    supabase.auth.getUser(),
    req.json(),
  ])
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('org_id, full_name').eq('id', user.id).single()
  const orgId = profile.data?.org_id
  const actorName = profile.data?.full_name ?? 'Someone'
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const { assigneeIds = [], watcherIds = [], ...fields } = body

  const { data: item, error } = await admin.from('atem_items').insert({
    org_id: orgId,
    created_by: user.id,
    title: fields.title || null,
    task: fields.task,
    deadline: fields.deadline || null,
    deadline_text: fields.deadline_text || null,
    action_plan: fields.action_plan || null,
    impact: fields.impact || null,
    dependencies: fields.dependencies || null,
    strategic_alignment: fields.strategic_alignment || null,
    consequences_of_delay: fields.consequences_of_delay || null,
    estimated_time: fields.estimated_time || null,
    status: fields.status || 'pending',
    priority: fields.priority || 'medium',
    tags: fields.tags || [],
    dept_id: fields.dept_id || null,
    team_id: fields.team_id || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allAssignees = (assigneeIds as string[]).includes(user.id) ? assigneeIds : [user.id, ...assigneeIds]

  // Insert assignees and watchers in parallel
  await Promise.all([
    allAssignees.length > 0
      ? admin.from('atem_assignees').insert(
          allAssignees.map((uid: string) => ({ atem_id: item.id, user_id: uid, assigned_by: user.id }))
        )
      : Promise.resolve(null),
    (watcherIds as string[]).length > 0
      ? admin.from('atem_watchers').insert(
          (watcherIds as string[]).map((uid: string) => ({ atem_id: item.id, user_id: uid }))
        )
      : Promise.resolve(null),
  ])

  // Fire-and-forget email — don't block response
  const notifyIds = (assigneeIds as string[]).filter((uid: string) => uid !== user.id)
  if (notifyIds.length > 0) {
    Promise.resolve(admin.from('profiles').select('id, full_name, email, contact_email').in('id', notifyIds))
      .then(({ data: recipients }) => {
        const atemUrl = `${APP_URL}/atem`
        const deadline = item.deadline
          ? new Date(item.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
          : undefined
        ;(recipients ?? []).filter((r: { email: string | null }) => r.email).forEach((r: { full_name: string; contact_email: string | null; email: string | null }) => {
          const to = r.contact_email || r.email
          if (!to) return
          const tpl = atemAssignedEmail({ recipientName: r.full_name, atemTask: item.task, assignedBy: actorName, deadline, atemUrl })
          sendEmail({ to, subject: tpl.subject, html: tpl.html }).catch(() => {})
        })
      })
      .catch(() => {})
  }

  return NextResponse.json({ item }, { status: 201 })
}
