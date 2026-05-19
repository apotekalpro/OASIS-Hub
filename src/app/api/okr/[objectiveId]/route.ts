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

  // Fetch subtasks (tasks linked to each KR)
  const krIds = (keyResultsRes.data ?? []).map(kr => kr.id)
  const subtasksRes = krIds.length > 0
    ? await admin.from('tasks').select('id, title, priority, kr_id').in('kr_id', krIds).order('created_at')
    : { data: [] }

  // Group subtasks by kr_id
  const subtasksByKr: Record<string, Array<{ id: string; title: string; priority: string }>> = {}
  for (const t of subtasksRes.data ?? []) {
    if (!subtasksByKr[t.kr_id]) subtasksByKr[t.kr_id] = []
    subtasksByKr[t.kr_id].push({ id: t.id, title: t.title, priority: t.priority })
  }

  const keyResultsWithSubtasks = (keyResultsRes.data ?? []).map(kr => ({
    ...kr,
    subtasks: subtasksByKr[kr.id] ?? [],
  }))

  return NextResponse.json({
    objective: data,
    assignees: assigneesRes.data ?? [],
    watchers: watchersRes.data ?? [],
    keyResults: keyResultsWithSubtasks,
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
    // Delete old subtask tasks linked to this objective's KRs
    const { data: oldKrs } = await admin.from('okr_key_results').select('id').eq('objective_id', objectiveId)
    const oldKrIds = (oldKrs ?? []).map(k => k.id)
    if (oldKrIds.length > 0) {
      await admin.from('tasks').delete().in('kr_id', oldKrIds)
    }

    // Replace all KRs (strip client-only fields: subtasks, _id, id)
    await admin.from('okr_key_results').delete().eq('objective_id', objectiveId)

    if (keyResults.length > 0) {
      const { data: insertedKrs } = await admin.from('okr_key_results').insert(
        keyResults.map((kr: Record<string, unknown>) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { subtasks: _s, id: _id, _id: __id, ...krFields } = kr
          return { ...krFields, objective_id: objectiveId }
        })
      ).select('id')

      // Create subtask tasks linked to newly inserted KRs
      const orgRes = await admin.from('okr_objectives').select('org_id, created_by').eq('id', objectiveId).single()
      const { org_id, created_by } = orgRes.data ?? {}

      for (let i = 0; i < keyResults.length; i++) {
        const subtasks = (keyResults[i] as Record<string, unknown>).subtasks as Array<{ title: string; priority?: string }> | undefined
        const krId = (insertedKrs ?? [])[i]?.id
        if (krId && subtasks && subtasks.length > 0) {
          await admin.from('tasks').insert(
            subtasks.filter(s => s.title?.trim()).map(s => ({
              title: s.title.trim(),
              priority: s.priority || 'medium',
              status: 'todo',
              org_id,
              created_by,
              kr_id: krId,
            }))
          )
        }
      }
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
