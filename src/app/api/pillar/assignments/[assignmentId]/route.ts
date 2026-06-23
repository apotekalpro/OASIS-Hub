import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canEditDeadline, canManagePillarTemplates } from '@/lib/auth/permissions'
import { getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [assignmentRes, krsRes, subtasksRes, commentsRes] = await Promise.all([
    admin.from('pillar_assignments')
      .select('*, outlets(name, code), profiles!pillar_assignments_assigned_to_fkey(id, full_name, avatar_url), departments(name)')
      .eq('id', assignmentId).single(),
    admin.from('pillar_assignment_krs').select('*').eq('assignment_id', assignmentId).order('created_at'),
    admin.from('pillar_subtasks').select('*').eq('assignment_id', assignmentId).order('position'),
    admin.from('pillar_comments').select('*, profiles(full_name, avatar_url)').eq('assignment_id', assignmentId).order('created_at'),
  ])

  if (assignmentRes.error || !assignmentRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    assignment: assignmentRes.data,
    keyResults: krsRes.data ?? [],
    subtasks: subtasksRes.data ?? [],
    comments: commentsRes.data ?? [],
  })
}

export async function PATCH(
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

  const { keyResults, ...fields } = body
  type KRPayload = { id: string; [key: string]: unknown }
  const krUpdates = Array.isArray(keyResults) ? (keyResults as KRPayload[]) : []

  // Month may only be changed by the assignee owner or dept_head+ (treated like a deadline)
  if ('month' in fields) {
    const [{ data: existing }, { data: profile }] = await Promise.all([
      admin.from('pillar_assignments').select('month, assigned_to, assigned_by').eq('id', assignmentId).single(),
      admin.from('profiles').select('role').eq('id', user.id).single(),
    ])
    if (existing) {
      const ownerId = existing.assigned_to ?? existing.assigned_by
      const allowed = canEditDeadline(user.id, (profile?.role ?? 'member') as UserRole, ownerId)
      if (!allowed && (existing.month ?? null) !== (fields.month ?? null)) {
        return NextResponse.json({ error: 'Only the assignee or an admin can change the month' }, { status: 403 })
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    const { error } = await admin.from('pillar_assignments').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', assignmentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (krUpdates.length > 0) {
    await Promise.all(krUpdates.map(kr => {
      const { id, ...krFields } = kr
      return admin.from('pillar_assignment_krs').update(krFields).eq('id', id)
    }))
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('org_id, role').eq('id', user.id).single()
  const role = profile.data?.role as UserRole | undefined
  const featurePermissions = await getCachedFeaturePermissions(profile.data?.org_id ?? '')
  if (!role || !canManagePillarTemplates(role, featurePermissions)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('pillar_assignments').delete().eq('id', assignmentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
