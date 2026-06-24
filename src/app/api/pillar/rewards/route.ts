import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calcIncentive1, calcRewardBreakdown } from '@/lib/pillar/rewards'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = req.nextUrl.searchParams.get('outletId')
  const month = req.nextUrl.searchParams.get('month')
  if (!outletId || !month) return NextResponse.json({ error: 'outletId and month required' }, { status: 400 })

  const [outletRes, assignmentsRes, headcountRes, inputRes] = await Promise.all([
    admin.from('outlets').select('id, org_id, category, name, code').eq('id', outletId).single(),
    admin.from('pillar_assignments').select('status, incentive1_amount, incentive1_basis').eq('outlet_id', outletId).eq('month', month),
    admin.from('outlet_staff').select('user_id', { count: 'exact', head: true }).eq('outlet_id', outletId),
    admin.from('pillar_monthly_inputs').select('revenue, focus_product_pct').eq('outlet_id', outletId).eq('month', month).maybeSingle(),
  ])

  const orgId = outletRes.data?.org_id
  if (!orgId) return NextResponse.json({ error: 'Outlet not found' }, { status: 404 })

  // outlet_id on pillar_targets can be null when the uploaded CSV's outlet code didn't
  // exactly match outlets.code at upload time — fall back to matching by code/org/month.
  let targetRes = await admin.from('pillar_targets').select('t1, t2, t3, category')
    .eq('outlet_id', outletId).eq('month', month).maybeSingle()
  if (!targetRes.data && outletRes.data?.code) {
    targetRes = await admin.from('pillar_targets').select('t1, t2, t3, category')
      .eq('org_id', orgId).eq('month', month).ilike('outlet_code', outletRes.data.code.trim()).maybeSingle()
  }

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

  const assignmentRows = assignmentsRes.data ?? []
  const incentive1Basis = assignmentRows.some(a => a.incentive1_basis === 'per_pax')
    ? 'per_pax'
    : assignmentRows.length > 0 ? 'per_outlet' : null

  const incentive1PerPax = calcIncentive1(assignmentRows.filter(a => a.incentive1_basis === 'per_pax'), headcount)
  const incentive1PerOutlet = calcIncentive1(assignmentRows.filter(a => a.incentive1_basis !== 'per_pax'), headcount)

  return NextResponse.json({
    breakdown,
    outletName: outletRes.data?.name ?? null,
    headcount,
    category: category ?? null,
    monthlyInput: inputRes.data ?? null,
    target: targetRes.data ?? null,
    incentive1Basis,
    incentive1ByBasis: { perPax: incentive1PerPax.achieved, perOutlet: incentive1PerOutlet.achieved },
  })
}
