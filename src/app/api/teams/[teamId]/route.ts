import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const body = await request.json()
  const { name, description, color, dept_id, is_private, memberIds = [] } = body

  const { error } = await admin.from('teams').update({
    name, description, color, dept_id: dept_id || null, is_private,
  }).eq('id', teamId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add any newly selected members (ignore if already a member)
  if ((memberIds as string[]).length > 0) {
    const rows = (memberIds as string[]).map((uid: string) => ({
      team_id: teamId, user_id: uid, role: 'member',
    }))
    await admin.from('team_members').upsert(rows, { onConflict: 'team_id,user_id', ignoreDuplicates: true })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Clear FK references before deleting the team
  await Promise.all([
    admin.from('channels').update({ team_id: null }).eq('team_id', teamId),
    admin.from('team_members').delete().eq('team_id', teamId),
    admin.from('tasks').update({ team_id: null }).eq('team_id', teamId),
  ])

  const { error } = await admin.from('teams').delete().eq('id', teamId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
