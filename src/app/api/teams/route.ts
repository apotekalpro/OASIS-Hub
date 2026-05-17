import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('org_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const allowed = ['super_admin', 'org_admin', 'dept_head', 'chief', 'team_leader']
  if (!allowed.includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const { name, description, color, dept_id, is_private, memberIds = [] } = body

  const { data: team, error: teamErr } = await admin.from('teams').insert({
    name, description, color, dept_id: dept_id || null, is_private,
    org_id: profile.org_id,
    created_by: user.id,
  }).select('id').single()

  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 })

  // Trigger trg_team_creator_leader already inserts creator as team_leader on team insert.
  // Only add the explicitly selected members (excluding creator to avoid duplicate).
  const extraMembers = (memberIds as string[])
    .filter(id => id !== user.id)
    .map((uid: string) => ({ team_id: team.id, user_id: uid, role: 'member' }))
  if (extraMembers.length > 0) {
    const { error: memberErr } = await admin.from('team_members').insert(extraMembers)
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 })
  }

  return NextResponse.json({ id: team.id })
}
