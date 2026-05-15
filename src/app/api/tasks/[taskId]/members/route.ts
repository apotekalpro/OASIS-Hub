import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createAdminClient()
  const [assigneesRes, watchersRes] = await Promise.all([
    admin.from('task_assignees').select('user_id').eq('task_id', taskId),
    admin.from('task_watchers').select('user_id').eq('task_id', taskId),
  ])

  return NextResponse.json({
    assigneeIds: assigneesRes.data?.map(a => a.user_id) ?? [],
    watcherIds: watchersRes.data?.map(w => w.user_id) ?? [],
  })
}
