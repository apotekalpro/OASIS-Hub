import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [assigneesRes, watchersRes] = await Promise.all([
    admin.from('task_assignees').select('user_id').eq('task_id', taskId),
    admin.from('task_watchers').select('user_id').eq('task_id', taskId),
  ])

  return NextResponse.json({
    assigneeIds: assigneesRes.data?.map(a => a.user_id) ?? [],
    watcherIds: watchersRes.data?.map(w => w.user_id) ?? [],
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { userId } = await req.json()
  const { error } = await admin.from('task_assignees').insert({ task_id: taskId, user_id: userId, assigned_by: user.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { userId } = await req.json()
  const { error } = await admin.from('task_assignees').delete().eq('task_id', taskId).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
