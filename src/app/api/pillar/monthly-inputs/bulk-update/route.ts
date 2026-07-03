import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('org_id, role').eq('id', user.id).single()
  const orgId = profile.data?.org_id
  const role = profile.data?.role as UserRole | undefined
  if (!orgId || !role) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const featurePermissions = await getCachedFeaturePermissions(orgId)
  if (!canManagePillarTemplates(role, featurePermissions)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const month = req.nextUrl.searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const [{ data: outlets }, { data: inputs }] = await Promise.all([
    admin.from('outlets').select('id, name, code').eq('org_id', orgId).order('name'),
    admin.from('pillar_monthly_inputs').select('outlet_id, revenue, focus_product_pct, as_of_date').eq('org_id', orgId).eq('month', month),
  ])

  const inputMap = new Map((inputs ?? []).map(i => [i.outlet_id, i]))
  const rows = (outlets ?? []).map(o => {
    const inp = inputMap.get(o.id)
    return {
      outletId: o.id,
      outletCode: o.code ?? '',
      outletName: o.name,
      revenue: inp?.revenue ?? 0,
      focusProductPct: inp?.focus_product_pct ?? 0,
      asOfDate: inp?.as_of_date ?? '',
    }
  })

  return NextResponse.json({ rows })
}

type InputRow = { outletId: string; month: string; revenue?: number; focusProductPct?: number; asOfDate?: string }
type FailedRow = { outletId: string; outletCode?: string; outletName?: string; reason: string }

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

  const { rows }: { rows: InputRow[] } = body
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: 'No rows provided' }, { status: 400 })

  // Verify all outlet IDs belong to this org
  const outletIds = [...new Set(rows.map(r => r.outletId).filter(Boolean))]
  const orgOutletIds = new Set<string>()
  for (let i = 0; i < outletIds.length; i += 500) {
    const { data } = await admin.from('outlets').select('id').eq('org_id', orgId).in('id', outletIds.slice(i, i + 500))
    if (data) data.forEach(o => orgOutletIds.add(o.id))
  }

  const failedRows: FailedRow[] = []
  let successCount = 0

  const BATCH = 50
  const validRows = rows.filter(r => {
    if (!r.outletId || !orgOutletIds.has(r.outletId)) {
      failedRows.push({ outletId: r.outletId ?? '', reason: 'Outlet not found or not in organisation' })
      return false
    }
    return true
  })

  for (let i = 0; i < validRows.length; i += BATCH) {
    const chunk = validRows.slice(i, i + BATCH)
    const results = await Promise.all(chunk.map(async row => {
      // Fetch existing to merge (don't overwrite fields not in CSV)
      const { data: existing } = await admin
        .from('pillar_monthly_inputs')
        .select('revenue, focus_product_pct, as_of_date')
        .eq('outlet_id', row.outletId)
        .eq('month', row.month)
        .maybeSingle()

      const upsertData: Record<string, unknown> = {
        org_id: orgId,
        outlet_id: row.outletId,
        month: row.month,
        revenue: row.revenue !== undefined ? Number(row.revenue) : (existing?.revenue ?? 0),
        focus_product_pct: row.focusProductPct !== undefined ? Number(row.focusProductPct) : (existing?.focus_product_pct ?? 0),
        as_of_date: row.asOfDate !== undefined ? (row.asOfDate || null) : (existing?.as_of_date ?? null),
        reported_by: user.id,
      }

      const { error } = await admin
        .from('pillar_monthly_inputs')
        .upsert(upsertData, { onConflict: 'outlet_id,month' })
      return error ? { outletId: row.outletId, reason: error.message } : null
    }))

    for (const r of results) {
      if (r) failedRows.push(r)
      else successCount++
    }
  }

  return NextResponse.json({ successCount, failedCount: failedRows.length, failedRows })
}
