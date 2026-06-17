import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canEditDeadline } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'

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

  type KRPayload = {
    id?: string
    subtasks?: Array<{ id?: string; title: string; priority?: string }>
    [key: string]: unknown
  }

  // Separate existing KRs (have id) from new ones (no id)
  const krsArray = Array.isArray(keyResults) ? (keyResults as KRPayload[]) : null
  const existingKrs = krsArray?.filter(kr => kr.id) ?? []
  const newKrs = krsArray?.filter(kr => !kr.id) ?? []
  const keptKrIds = existingKrs.map(kr => kr.id as string)

  // Deadlines (objective end_date + KR due_date) may only be changed by the owner or dept_head+
  const krDueDateChanges = existingKrs.filter(kr => 'due_date' in kr)
  if ('end_date' in fields || krDueDateChanges.length > 0) {
    const [{ data: existingObjective }, { data: profile }, { data: existingKrRows }] = await Promise.all([
      admin.from('okr_objectives').select('end_date, created_by').eq('id', objectiveId).single(),
      admin.from('profiles').select('role').eq('id', user.id).single(),
      krDueDateChanges.length > 0
        ? admin.from('okr_key_results').select('id, due_date').in('id', krDueDateChanges.map(kr => kr.id as string))
        : Promise.resolve({ data: [] as { id: string; due_date: string | null }[] }),
    ])
    if (existingObjective) {
      const allowed = canEditDeadline(user.id, (profile?.role ?? 'member') as UserRole, existingObjective.created_by)
      if (!allowed) {
        const objDateChanged = 'end_date' in fields && (existingObjective.end_date ?? null) !== (fields.end_date ?? null)
        const krDateChanged = krDueDateChanges.some(kr => {
          const existing = (existingKrRows ?? []).find(r => r.id === kr.id)
          return existing && (existing.due_date ?? null) !== (kr.due_date ?? null)
        })
        if (objDateChanged || krDateChanged) {
          return NextResponse.json({ error: 'Only the objective owner or an admin can change deadlines' }, { status: 403 })
        }
      }
    }
  }

  // Phase 1: update objective + delete removed KRs + delete assignees/watchers
  const [updateResult, orgRes] = await Promise.all([
    Object.keys(fields).length > 0
      ? admin.from('okr_objectives').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', objectiveId)
      : Promise.resolve({ error: null }),
    krsArray
      ? admin.from('okr_objectives').select('org_id, created_by').eq('id', objectiveId).single()
      : Promise.resolve({ data: null }),
    Array.isArray(assigneeIds)
      ? admin.from('okr_assignees').delete().eq('objective_id', objectiveId)
      : Promise.resolve(null),
    Array.isArray(watcherIds)
      ? admin.from('okr_watchers').delete().eq('objective_id', objectiveId)
      : Promise.resolve(null),
    // Delete only KRs that were removed (not in the kept list); CASCADE removes their subtasks
    krsArray
      ? keptKrIds.length > 0
        ? admin.from('okr_key_results').delete().eq('objective_id', objectiveId).not('id', 'in', `(${keptKrIds.join(',')})`)
        : admin.from('okr_key_results').delete().eq('objective_id', objectiveId)
      : Promise.resolve(null),
  ])

  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 })

  const { org_id, created_by } = (orgRes as { data: { org_id: string; created_by: string } | null }).data ?? {}

  // Phase 2: update existing KRs + insert new KRs + assignees/watchers in parallel
  const updateKrOps = existingKrs.map(kr => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, subtasks: _s, ...krFields } = kr
    return Promise.resolve(
      admin.from('okr_key_results')
        .update({ ...krFields })
        .eq('id', id as string)
    )
  })

  const [newKrResult] = await Promise.all([
    newKrs.length > 0
      ? admin.from('okr_key_results').insert(
          newKrs.map(kr => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { subtasks: _s, id: _id, ...krFields } = kr
            return { ...krFields, objective_id: objectiveId }
          })
        ).select('id')
      : Promise.resolve({ data: null }),
    ...updateKrOps,
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

  if (!org_id) return NextResponse.json({ success: true })

  // Phase 3: sync subtasks — preserve existing, add new, delete removed
  const insertedNewKrs = (newKrResult as { data: Array<{ id: string }> | null }).data ?? []
  const subtaskOps: Promise<unknown>[] = []

  // Existing KRs: delete removed subtasks, insert new ones
  for (const kr of existingKrs) {
    const subs = kr.subtasks ?? []
    const keptSubIds = subs.filter(s => s.id).map(s => s.id as string)
    const brandNewSubs = subs.filter(s => !s.id && s.title?.trim())

    // Delete subtasks for this KR that the user removed from the form
    if (keptSubIds.length > 0) {
      subtaskOps.push(
        Promise.resolve(
          admin.from('tasks').delete()
            .eq('kr_id', kr.id as string)
            .not('id', 'in', `(${keptSubIds.join(',')})`)
        )
      )
    } else if (subs.length === 0) {
      // User cleared all subtasks from this KR
      subtaskOps.push(Promise.resolve(admin.from('tasks').delete().eq('kr_id', kr.id as string)))
    }

    if (brandNewSubs.length > 0) {
      subtaskOps.push(
        Promise.resolve(
          admin.from('tasks').insert(
            brandNewSubs.map(s => ({
              title: s.title.trim(),
              priority: s.priority || 'medium',
              status: 'todo',
              org_id,
              created_by,
              kr_id: kr.id as string,
              is_okr_subtask: true,
            }))
          )
        )
      )
    }
  }

  // New KRs: insert all their subtasks
  newKrs.forEach((kr, i) => {
    const krId = insertedNewKrs[i]?.id
    if (!krId) return
    const newSubs = (kr.subtasks ?? []).filter(s => s.title?.trim())
    if (newSubs.length > 0) {
      subtaskOps.push(
        Promise.resolve(
          admin.from('tasks').insert(
            newSubs.map(s => ({
              title: s.title.trim(),
              priority: s.priority || 'medium',
              status: 'todo',
              org_id,
              created_by,
              kr_id: krId,
              is_okr_subtask: true,
            }))
          )
        )
      )
    }
  })

  if (subtaskOps.length > 0) await Promise.all(subtaskOps)

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
