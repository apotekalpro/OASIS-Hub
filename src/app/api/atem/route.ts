import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = profile.data?.org_id
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const body = await req.json()
  const { assigneeIds = [], watcherIds = [], ...fields } = body

  const { data: item, error } = await admin.from('atem_items').insert({
    org_id: orgId,
    created_by: user.id,
    task: fields.task,
    deadline: fields.deadline || null,
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

  const allAssignees = assigneeIds.includes(user.id) ? assigneeIds : [user.id, ...assigneeIds]
  if (allAssignees.length > 0) {
    await admin.from('atem_assignees').insert(
      allAssignees.map((uid: string) => ({ atem_id: item.id, user_id: uid, assigned_by: user.id }))
    )
  }
  if (watcherIds.length > 0) {
    await admin.from('atem_watchers').insert(
      watcherIds.map((uid: string) => ({ atem_id: item.id, user_id: uid }))
    )
  }

  return NextResponse.json({ item }, { status: 201 })
}
