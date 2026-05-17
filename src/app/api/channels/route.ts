import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile?.org_id) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const body = await req.json() as { name: string; description?: string; is_private?: boolean }
  const { name, description, is_private } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data: channel, error } = await admin
    .from('channels')
    .insert({
      org_id: profile.org_id,
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      description: description?.trim() || null,
      is_private: is_private ?? false,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add creator as channel member
  await admin.from('channel_members').insert({ channel_id: channel.id, user_id: user.id })

  return NextResponse.json(channel)
}
