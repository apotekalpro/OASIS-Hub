import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import { calcRewardBreakdown, type RewardAssignmentInput } from '@/lib/pillar/rewards'
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
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })
  const featurePermissions = await getCachedFeaturePermissions(orgId)
  if (!role || !canManagePillarTemplates(role, featurePermissions)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const month = req.nextUrl.searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const [outletsRes, assignmentsRes, targetsRes, inputsRes, matrixRes, staffRes] = await Promise.all([
    admin.from('outlets').select('id, name, code, category, area_manager_id, profiles:area_manager_id(full_name)').eq('org_id', orgId).ilike('name', '%Apotek Alpro%').order('name'),
    admin.from('pillar_assignments').select('outlet_id, title, status, progress, incentive1_amount, incentive1_basis').eq('org_id', orgId).eq('month', month).not('outlet_id', 'is', null),
    admin.from('pillar_targets').select('outlet_id, t1, t2, t3, category').eq('org_id', orgId).eq('month', month),
    admin.from('pillar_monthly_inputs').select('outlet_id, revenue, focus_product_pct').eq('org_id', orgId).eq('month', month),
    admin.from('pillar_reward_tiers').select('category, t1_reward, t2_reward, t3_reward').eq('org_id', orgId),
    admin.from('outlet_staff').select('outlet_id'),
  ])

  type OutletRow = { id: string; name: string; code: string | null; category: string | null; area_manager_id: string | null; profiles: { full_name: string } | { full_name: string }[] | null }
  const outlets = (outletsRes.data ?? []) as unknown as OutletRow[]
  const assignments = (assignmentsRes.data ?? []) as (RewardAssignmentInput & { outlet_id: string; title: string; progress: number })[]
  const targets = (targetsRes.data ?? []) as { outlet_id: string | null; t1: number; t2: number; t3: number; category: string }[]
  const inputs = (inputsRes.data ?? []) as { outlet_id: string; revenue: number; focus_product_pct: number }[]
  const matrices = (matrixRes.data ?? []) as { category: string; t1_reward: number; t2_reward: number; t3_reward: number }[]
  const staffCounts = (staffRes.data ?? []).reduce<Record<string, number>>((acc, s: { outlet_id: string }) => {
    acc[s.outlet_id] = (acc[s.outlet_id] ?? 0) + 1
    return acc
  }, {})

  const targetByOutlet = new Map(targets.filter(t => t.outlet_id).map(t => [t.outlet_id as string, t]))
  const inputByOutlet = new Map(inputs.map(i => [i.outlet_id, i]))
  const matrixByCategory = new Map(matrices.map(m => [m.category, m]))

  const rows = outlets.map(o => {
    const amName = Array.isArray(o.profiles) ? o.profiles[0]?.full_name : o.profiles?.full_name
    const outletAssignments = assignments.filter(a => a.outlet_id === o.id)
    const headcount = staffCounts[o.id] ?? 1
    const target = targetByOutlet.get(o.id) ?? null
    const input = inputByOutlet.get(o.id) ?? null
    const category = target?.category ?? o.category?.toLowerCase() ?? null
    const matrix = category ? matrixByCategory.get(category) ?? null : null

    const breakdown = calcRewardBreakdown({
      assignments: outletAssignments,
      headcount,
      revenue: input?.revenue ?? 0,
      focusProductPct: input?.focus_product_pct ?? 0,
      targets: target ? { t1: target.t1, t2: target.t2, t3: target.t3 } : null,
      matrix,
    })

    return {
      outletId: o.id,
      outletName: o.name,
      outletCode: o.code,
      areaManagerName: amName ?? null,
      pillarsTotal: outletAssignments.length,
      pillarsCompleted: outletAssignments.filter(a => a.status === 'completed').length,
      avgProgress: outletAssignments.length > 0 ? Math.round(outletAssignments.reduce((s, a) => s + Number(a.progress ?? 0), 0) / outletAssignments.length) : 0,
      revenue: input?.revenue ?? 0,
      focusProductPct: input?.focus_product_pct ?? 0,
      category,
      incentive1Achieved: breakdown.incentive1.achieved,
      incentive1Potential: breakdown.incentive1.potential,
      incentive2Achieved: breakdown.incentive2.achieved,
      incentive2Potential: breakdown.incentive2.potential,
      incentive3Achieved: breakdown.incentive3.achieved,
      incentive3Potential: breakdown.incentive3.potential,
      totalAchieved: breakdown.total.achieved,
      totalPotential: breakdown.total.potential,
    }
  })

  return NextResponse.json({ rows, month })
}
