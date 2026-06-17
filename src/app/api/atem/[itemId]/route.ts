import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canEditDeadline } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [itemRes, assigneesRes, watchersRes] = await Promise.all([
    admin.from('atem_items').select('*, departments(name), teams(name)').eq('id', itemId).single(),
    admin.from('atem_assignees').select('user_id').eq('atem_id', itemId),
    admin.from('atem_watchers').select('user_id').eq('atem_id', itemId),
  ])

  if (itemRes.error) return NextResponse.json({ error: itemRes.error.message }, { status: 404 })

  return NextResponse.json({
    item: itemRes.data,
    assigneeIds: (assigneesRes.data ?? []).map(a => a.user_id),
    watcherIds: (watchersRes.data ?? []).map(w => w.user_id),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: { user } }, body] = await Promise.all([
    supabase.auth.getUser(),
    req.json(),
  ])
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { assigneeIds, watcherIds, ...fields } = body

  // Deadline may only be changed by the item owner or dept_head+
  if ('deadline' in fields) {
    const [{ data: existingItem }, { data: profile }] = await Promise.all([
      admin.from('atem_items').select('deadline, created_by').eq('id', itemId).single(),
      admin.from('profiles').select('role').eq('id', user.id).single(),
    ])
    const deadlineChanged = (existingItem?.deadline ?? null) !== (fields.deadline ?? null)
    if (deadlineChanged && existingItem && !canEditDeadline(user.id, (profile?.role ?? 'member') as UserRole, existingItem.created_by)) {
      return NextResponse.json({ error: 'Only the item owner or an admin can change the deadline' }, { status: 403 })
    }
  }

  // Phase 1: update + delete in parallel
  const [updateResult] = await Promise.all([
    admin.from('atem_items').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', itemId),
    assigneeIds !== undefined
      ? admin.from('atem_assignees').delete().eq('atem_id', itemId)
      : Promise.resolve(null),
    watcherIds !== undefined
      ? admin.from('atem_watchers').delete().eq('atem_id', itemId)
      : Promise.resolve(null),
  ])
  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 })

  // Phase 2: insert new assignees/watchers in parallel
  await Promise.all([
    assigneeIds !== undefined && (assigneeIds as string[]).length > 0
      ? admin.from('atem_assignees').insert(
          (assigneeIds as string[]).map((uid: string) => ({ atem_id: itemId, user_id: uid, assigned_by: user.id }))
        )
      : Promise.resolve(null),
    watcherIds !== undefined && (watcherIds as string[]).length > 0
      ? admin.from('atem_watchers').insert(
          (watcherIds as string[]).map((uid: string) => ({ atem_id: itemId, user_id: uid }))
        )
      : Promise.resolve(null),
  ])

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await admin.from('atem_items').delete().eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
