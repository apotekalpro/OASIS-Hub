import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await admin.from('atem_items')
    .select('*, departments(name), teams(name)')
    .eq('id', params.itemId).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const [assigneesRes, watchersRes] = await Promise.all([
    admin.from('atem_assignees').select('user_id').eq('atem_id', params.itemId),
    admin.from('atem_watchers').select('user_id').eq('atem_id', params.itemId),
  ])

  return NextResponse.json({
    item: data,
    assigneeIds: (assigneesRes.data ?? []).map(a => a.user_id),
    watcherIds: (watchersRes.data ?? []).map(w => w.user_id),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { assigneeIds, watcherIds, ...fields } = body

  const { error } = await admin.from('atem_items').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', params.itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (assigneeIds !== undefined) {
    await admin.from('atem_assignees').delete().eq('atem_id', params.itemId)
    if (assigneeIds.length > 0) {
      await admin.from('atem_assignees').insert(assigneeIds.map((uid: string) => ({ atem_id: params.itemId, user_id: uid, assigned_by: user.id })))
    }
  }
  if (watcherIds !== undefined) {
    await admin.from('atem_watchers').delete().eq('atem_id', params.itemId)
    if (watcherIds.length > 0) {
      await admin.from('atem_watchers').insert(watcherIds.map((uid: string) => ({ atem_id: params.itemId, user_id: uid })))
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await admin.from('atem_items').delete().eq('id', params.itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
