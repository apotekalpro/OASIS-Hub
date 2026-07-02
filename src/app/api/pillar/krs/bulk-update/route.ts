import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = new Set(['not_started', 'on_track', 'at_risk', 'behind', 'completed'])

type UpdateRow = { krId: string; title?: string; currentValue: number; targetValue?: number; status?: string }
type FailedRow = { krId: string; reason: string }

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

  // Fetch all KRs in batches of 500 to avoid Supabase URL length limits
  const ownedKrsList: { id: string; assignment_id: string }[] = []
  for (let i = 0; i < krIds.length; i += 500) {
    const { data } = await admin
      .from('pillar_assignment_krs')
      .select('id, assignment_id')
      .in('id', krIds.slice(i, i + 500))
    if (data) ownedKrsList.push(...data)
  }

  const foundIds = new Set(ownedKrsList.map(k => k.id))

  // Verify assignments belong to this org
  const assignmentIds = Array.from(new Set(ownedKrsList.map(k => k.assignment_id)))
  const orgAssignmentIds = new Set<string>()
  for (let i = 0; i < assignmentIds.length; i += 500) {
    const { data } = await admin
      .from('pillar_assignments')
      .select('id')
      .eq('org_id', orgId)
      .in('id', assignmentIds.slice(i, i + 500))
    if (data) data.forEach(a => orgAssignmentIds.add(a.id))
  }

  const ownedIds = new Set(
    ownedKrsList.filter(k => orgAssignmentIds.has(k.assignment_id)).map(k => k.id)
  )

  let successCount = 0
  const failedRows: FailedRow[] = []

  for (const row of rows) {
    if (!foundIds.has(row.krId)) {
      failedRows.push({ krId: row.krId, reason: 'KR not found in database' })
      continue
    }
    if (!ownedIds.has(row.krId)) {
      failedRows.push({ krId: row.krId, reason: 'Not authorised for this organisation' })
      continue
    }
    const patch: { current_value: number; title?: string; target_value?: number; status?: string } = { current_value: Number(row.currentValue) || 0 }
    if (row.title?.trim()) patch.title = row.title.trim()
    if (row.targetValue !== undefined && !isNaN(row.targetValue)) patch.target_value = row.targetValue
    if (row.status && VALID_STATUSES.has(row.status)) patch.status = row.status
    const { error } = await admin.from('pillar_assignment_krs').update(patch).eq('id', row.krId)
    if (error) failedRows.push({ krId: row.krId, reason: error.message })
    else successCount++
  }

  return NextResponse.json({ successCount, failedCount: failedRows.length, failedRows })
}
