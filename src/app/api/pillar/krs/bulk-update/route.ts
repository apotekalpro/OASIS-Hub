import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = new Set(['not_started', 'on_track', 'at_risk', 'behind', 'completed'])

type UpdateRow = { krId: string; currentValue: number; targetValue?: number; status?: string }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: { user } }, body] = await Promise.all([
    supabase.auth.getUser(),
    req.json(),
  ])
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('org_id, role').eq('id', user.id).single()
  const orgId = profile.data?.org_id
  const role = profile.data?.role as UserRole | undefined
  if (!orgId || !role) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const featurePermissions = await getCachedFeaturePermissions(orgId)
  if (!canManagePillarTemplates(role, featurePermissions)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows }: { rows: UpdateRow[] } = body
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: 'No rows provided' }, { status: 400 })

  const krIds = rows.map(r => r.krId).filter(Boolean)
  const { data: ownedKrs } = await admin
    .from('pillar_assignment_krs')
    .select('id, assignment_id')
    .in('id', krIds)

  const assignmentIds = Array.from(new Set((ownedKrs ?? []).map(k => k.assignment_id)))
  const { data: orgAssignments } = assignmentIds.length > 0
    ? await admin.from('pillar_assignments').select('id').eq('org_id', orgId).in('id', assignmentIds)
    : { data: [] as { id: string }[] }
  const orgAssignmentIds = new Set((orgAssignments ?? []).map(a => a.id))

  const ownedIds = new Set((ownedKrs ?? [])
    .filter(k => orgAssignmentIds.has(k.assignment_id))
    .map(k => k.id))

  let successCount = 0
  const failedIds: string[] = []

  for (const row of rows) {
    if (!ownedIds.has(row.krId)) { failedIds.push(row.krId); continue }
    const patch: { current_value: number; target_value?: number; status?: string } = { current_value: Number(row.currentValue) || 0 }
    if (row.targetValue !== undefined && !isNaN(row.targetValue)) patch.target_value = row.targetValue
    if (row.status && VALID_STATUSES.has(row.status)) patch.status = row.status
    const { error } = await admin.from('pillar_assignment_krs').update(patch).eq('id', row.krId)
    if (error) failedIds.push(row.krId)
    else successCount++
  }

  return NextResponse.json({ successCount, failedCount: failedIds.length, failedIds })
}
