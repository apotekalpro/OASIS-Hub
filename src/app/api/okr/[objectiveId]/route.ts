import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await admin.from('okr_objectives')
    .select('*, departments(name), teams(name)')
    .eq('id', objectiveId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [assigneesRes, watchersRes, keyResultsRes] = await Promise.all([
    admin.from('okr_assignees').select('user_id, role').eq('objective_id', objectiveId),
    admin.from('okr_watchers').select('user_id').eq('objective_id', objectiveId),
    admin.from('okr_key_results').select('*').eq('objective_id', objectiveId).order('created_at'),
  ])

  return NextResponse.json({
    objective: data,
    assignees: assigneesRes.data ?? [],
    watchers: watchersRes.data ?? [],
    keyResults: keyResultsRes.data ?? [],
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { assigneeIds, watcherIds, keyResults, ...fields } = body

  if (Object.keys(fields).length > 0) {
    const { error } = await admin.from('okr_objectives')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', objectiveId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (Array.isArray(assigneeIds)) {
    await admin.from('okr_assignees').delete().eq('objective_id', objectiveId)
    if (assigneeIds.length > 0) {
      await admin.from('okr_assignees').insert(
        assigneeIds.map((uid: string, idx: number) => ({
          objective_id: objectiveId,
          user_id: uid,
          role: idx === 0 ? 'owner' : 'contributor',
        }))
      )
    }
  }

  if (Array.isArray(watcherIds)) {
    await admin.from('okr_watchers').delete().eq('objective_id', objectiveId)
    if (watcherIds.length > 0) {
      await admin.from('okr_watchers').insert(
        watcherIds.map((uid: string) => ({ objective_id: objectiveId, user_id: uid }))
      )
    }
  }

  if (Array.isArray(keyResults)) {
    // Replace all KRs
    await admin.from('okr_key_results').delete().eq('objective_id', objectiveId)
    if (keyResults.length > 0) {
      await admin.from('okr_key_results').insert(
        keyResults.map((kr: Record<string, unknown>) => ({ ...kr, objective_id: objectiveId }))
      )
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await admin.from('okr_objectives').delete().eq('id', objectiveId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
