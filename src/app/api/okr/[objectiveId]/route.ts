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

  const [objRes, assigneesRes, watchersRes, keyResultsRes] = await Promise.all([
    admin.from('okr_objectives').select('*, departments(name), teams(name)').eq('id', objectiveId).single(),
    admin.from('okr_assignees').select('user_id, role').eq('objective_id', objectiveId),
    admin.from('okr_watchers').select('user_id').eq('objective_id', objectiveId),
    admin.from('okr_key_results').select('*').eq('objective_id', objectiveId).order('created_at'),
  ])

  if (objRes.error || !objRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const krIds = (keyResultsRes.data ?? []).map(kr => kr.id)
  const subtasksRes = krIds.length > 0
    ? await admin.from('tasks').select('id, title, priority, kr_id').in('kr_id', krIds).order('created_at')
    : { data: [] }

  const subtasksByKr: Record<string, Array<{ id: string; title: string; priority: string }>> = {}
  for (const t of subtasksRes.data ?? []) {
    if (!subtasksByKr[t.kr_id]) subtasksByKr[t.kr_id] = []
    subtasksByKr[t.kr_id].push({ id: t.id, title: t.title, priority: t.priority })
  }

  return NextResponse.json({
    objective: objRes.data,
    assignees: assigneesRes.data ?? [],
    watchers: watchersRes.data ?? [],
    keyResults: (keyResultsRes.data ?? []).map(kr => ({ ...kr, subtasks: subtasksByKr[kr.id] ?? [] })),
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: { user } }, body] = await Promise.all([
    supabase.auth.getUser(),
    req.json(),
  ])
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { assigneeIds, watcherIds, keyResults, ...fields } = body

  // Phase 1: update objective + delete stale data in parallel.
  // Note: deleting okr_key_results cascades to tasks (migration 040), no separate task delete needed.
  const [updateResult, orgRes] = await Promise.all([
    Object.keys(fields).length > 0
      ? admin.from('okr_objectives').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', objectiveId)
      : Promise.resolve({ error: null }),
    Array.isArray(keyResults)
      ? admin.from('okr_objectives').select('org_id, created_by').eq('id', objectiveId).single()
      : Promise.resolve({ data: null }),
    Array.isArray(assigneeIds)
      ? admin.from('okr_assignees').delete().eq('objective_id', objectiveId)
      : Promise.resolve(null),
    Array.isArray(watcherIds)
      ? admin.from('okr_watchers').delete().eq('objective_id', objectiveId)
      : Promise.resolve(null),
    Array.isArray(keyResults)
      ? admin.from('okr_key_results').delete().eq('objective_id', objectiveId)
      : Promise.resolve(null),
  ])

  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 })

  const { org_id, created_by } = (orgRes as { data: { org_id: string; created_by: string } | null }).data ?? {}

  // Phase 2: insert new data in parallel
  const [krResult] = await Promise.all([
    Array.isArray(keyResults) && keyResults.length > 0
      ? admin.from('okr_key_results').insert(
          keyResults.map((kr: Record<string, unknown>) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { subtasks: _s, id: _id, _id: __id, ...krFields } = kr
            return { ...krFields, objective_id: objectiveId }
          })
        ).select('id')
      : Promise.resolve({ data: null }),
    Array.isArray(assigneeIds) && assigneeIds.length > 0
      ? admin.from('okr_assignees').insert(
          (assigneeIds as string[]).map((uid: string, idx: number) => ({
            objective_id: objectiveId,
            user_id: uid,
            role: idx === 0 ? 'owner' : 'contributor',
          }))
        )
      : Promise.resolve(null),
    Array.isArray(watcherIds) && watcherIds.length > 0
      ? admin.from('okr_watchers').insert(
          (watcherIds as string[]).map((uid: string) => ({ objective_id: objectiveId, user_id: uid }))
        )
      : Promise.resolve(null),
  ])

  // Phase 3: create subtasks for all KRs in parallel (no sequential loop)
  const insertedKrs = (krResult as { data: Array<{ id: string }> | null }).data
  if (insertedKrs && Array.isArray(keyResults) && org_id) {
    const subtaskInserts = keyResults.flatMap((kr: Record<string, unknown>, i: number) => {
      const subtasks = kr.subtasks as Array<{ title: string; priority?: string }> | undefined
      const krId = insertedKrs[i]?.id
      if (!krId || !subtasks?.length) return []
      return [admin.from('tasks').insert(
        subtasks.filter(s => s.title?.trim()).map(s => ({
          title: s.title.trim(),
          priority: s.priority || 'medium',
          status: 'todo',
          org_id,
          created_by,
          kr_id: krId,
          is_okr_subtask: true,
        }))
      )]
    })
    if (subtaskInserts.length > 0) await Promise.all(subtaskInserts)
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
