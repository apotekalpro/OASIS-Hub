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

  const profile = await admin.from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = profile.data?.org_id
  if (!orgId) return NextResponse.json({ targets: [] })

  const month = req.nextUrl.searchParams.get('month')
  let query = admin.from('pillar_targets').select('*').eq('org_id', orgId).order('month', { ascending: false }).order('outlet_code')
  if (month) query = query.eq('month', month)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ targets: data ?? [] })
}

type UploadRow = { outletCode: string; outletName?: string; category: string; t1: number; t2: number; t3: number }

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
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })
  const featurePermissions = await getCachedFeaturePermissions(orgId)
  if (!role || !canManagePillarTemplates(role, featurePermissions)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows, months }: { rows: UploadRow[]; months: string[] } = body
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  if (!Array.isArray(months) || months.length === 0) return NextResponse.json({ error: 'Select at least one month' }, { status: 400 })

  const codes = Array.from(new Set(rows.map(r => r.outletCode).filter(Boolean)))
  const { data: outletRows } = codes.length > 0
    ? await admin.from('outlets').select('id, code').eq('org_id', orgId).in('code', codes)
    : { data: [] }
  const outletByCode = new Map((outletRows ?? []).map(o => [o.code, o.id]))

  const upsertRows = months.flatMap(month =>
    rows.filter(r => r.outletCode).map(r => ({
      org_id: orgId,
      outlet_id: outletByCode.get(r.outletCode) ?? null,
      outlet_code: r.outletCode,
      outlet_name: r.outletName || null,
      category: (r.category || 'bronze').toLowerCase(),
      month,
      t1: Number(r.t1) || 0,
      t2: Number(r.t2) || 0,
      t3: Number(r.t3) || 0,
      uploaded_by: user.id,
    }))
  )

  const { data, error } = await admin.from('pillar_targets')
    .upsert(upsertRows, { onConflict: 'org_id,outlet_code,month' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unmatchedCodes = Array.from(new Set(rows.filter(r => r.outletCode && !outletByCode.has(r.outletCode)).map(r => r.outletCode)))
  const failedCount = unmatchedCodes.length * months.length

  return NextResponse.json({
    targets: data ?? [],
    count: data?.length ?? 0,
    successCount: data?.length ?? 0,
    failedCount,
    unmatchedCodes,
  }, { status: 201 })
}
