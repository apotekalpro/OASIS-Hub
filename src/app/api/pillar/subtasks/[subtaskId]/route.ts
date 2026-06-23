import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ subtaskId: string }> }
) {
  const { subtaskId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: { user } }, body] = await Promise.all([
    supabase.auth.getUser(),
    req.json(),
  ])
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await admin.from('pillar_subtasks').update({ ...body, updated_at: new Date().toISOString() }).eq('id', subtaskId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ subtaskId: string }> }
) {
  const { subtaskId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await admin.from('pillar_subtasks').delete().eq('id', subtaskId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
