import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: { user } }, body] = await Promise.all([
    supabase.auth.getUser(),
    req.json(),
  ])
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await admin.from('pillar_subtasks').select('position').eq('assignment_id', assignmentId).order('position', { ascending: false }).limit(1)
  const nextPosition = (existing?.[0]?.position ?? -1) + 1

  const { data, error } = await admin.from('pillar_subtasks').insert({
    assignment_id: assignmentId,
    title: body.title,
    created_by: user.id,
    position: nextPosition,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subtask: data }, { status: 201 })
}
