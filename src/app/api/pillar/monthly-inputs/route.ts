import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

async function canReportForOutlet(admin: ReturnType<typeof createAdminClient>, userId: string, role: UserRole, outletId: string) {
  if (canManagePillarTemplates(role)) return true
  const { data: outlet } = await admin.from('outlets').select('area_manager_id').eq('id', outletId).single()
  if (outlet?.area_manager_id === userId) return true
  const { data: profile } = await admin.from('profiles').select('outlet_id').eq('id', userId).single()
  if (profile?.outlet_id === outletId) return true
  const { data: staffRow } = await admin.from('outlet_staff').select('outlet_id').eq('outlet_id', outletId).eq('user_id', userId).maybeSingle()
  return !!staffRow
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = req.nextUrl.searchParams.get('outletId')
  const month = req.nextUrl.searchParams.get('month')
  if (!outletId || !month) return NextResponse.json({ error: 'outletId and month required' }, { status: 400 })

  const { data, error } = await admin.from('pillar_monthly_inputs').select('*').eq('outlet_id', outletId).eq('month', month).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ input: data ?? null })
}

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

  const { outletId, month, revenue = 0, focusProductPct = 0 }: { outletId: string; month: string; revenue: number; focusProductPct: number } = body
  if (!outletId || !month) return NextResponse.json({ error: 'outletId and month required' }, { status: 400 })

  if (!(await canReportForOutlet(admin, user.id, role, outletId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await admin.from('pillar_monthly_inputs')
    .upsert({
      org_id: orgId,
      outlet_id: outletId,
      month,
      revenue: Number(revenue) || 0,
      focus_product_pct: Number(focusProductPct) || 0,
      reported_by: user.id,
    }, { onConflict: 'outlet_id,month' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ input: data })
}
