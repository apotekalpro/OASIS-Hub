import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calcRewardBreakdown } from '@/lib/pillar/rewards'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = req.nextUrl.searchParams.get('outletId')
  const month = req.nextUrl.searchParams.get('month')
  if (!outletId || !month) return NextResponse.json({ error: 'outletId and month required' }, { status: 400 })

  const [outletRes, assignmentsRes, headcountRes, targetRes, inputRes] = await Promise.all([
    admin.from('outlets').select('id, org_id, category').eq('id', outletId).single(),
    admin.from('pillar_assignments').select('status, incentive1_amount, incentive1_basis').eq('outlet_id', outletId).eq('month', month),
    admin.from('outlet_staff').select('user_id', { count: 'exact', head: true }).eq('outlet_id', outletId),
    admin.from('pillar_targets').select('t1, t2, t3, category').eq('outlet_id', outletId).eq('month', month).maybeSingle(),
    admin.from('pillar_monthly_inputs').select('revenue, focus_product_pct').eq('outlet_id', outletId).eq('month', month).maybeSingle(),
  ])

  const orgId = outletRes.data?.org_id
  if (!orgId) return NextResponse.json({ error: 'Outlet not found' }, { status: 404 })

  const category = targetRes.data?.category ?? outletRes.data?.category?.toLowerCase()
  const matrixRes = category
    ? await admin.from('pillar_reward_tiers').select('t1_reward, t2_reward, t3_reward').eq('org_id', orgId).eq('category', category).maybeSingle()
    : { data: null }

  const headcount = headcountRes.count ?? 1
  const breakdown = calcRewardBreakdown({
    assignments: assignmentsRes.data ?? [],
    headcount,
    revenue: inputRes.data?.revenue ?? 0,
    focusProductPct: inputRes.data?.focus_product_pct ?? 0,
    targets: targetRes.data ? { t1: targetRes.data.t1, t2: targetRes.data.t2, t3: targetRes.data.t3 } : null,
    matrix: matrixRes.data ?? null,
  })

  return NextResponse.json({
    breakdown,
    headcount,
    category: category ?? null,
    monthlyInput: inputRes.data ?? null,
    target: targetRes.data ?? null,
  })
}
