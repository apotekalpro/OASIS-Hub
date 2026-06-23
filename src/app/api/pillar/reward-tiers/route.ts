import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import { REWARD_CATEGORIES } from '@/lib/pillar/rewards'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

const DEFAULT_MATRIX: Record<string, { revenue_min: number; revenue_max: number | null; t1_reward: number; t2_reward: number; t3_reward: number }> = {
  bronze:   { revenue_min: 0,         revenue_max: 150000000,  t1_reward: 200000, t2_reward: 300000, t3_reward: 500000 },
  silver:   { revenue_min: 150000000, revenue_max: 350000000,  t1_reward: 250000, t2_reward: 350000, t3_reward: 600000 },
  gold:     { revenue_min: 350000000, revenue_max: 550000000,  t1_reward: 300000, t2_reward: 450000, t3_reward: 750000 },
  platinum: { revenue_min: 550000000, revenue_max: 750000000,  t1_reward: 400000, t2_reward: 600000, t3_reward: 950000 },
  titanium: { revenue_min: 750000000, revenue_max: 1000000000, t1_reward: 500000, t2_reward: 750000, t3_reward: 1200000 },
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = profile.data?.org_id
  if (!orgId) return NextResponse.json({ tiers: [] })

  const { data, error } = await admin.from('pillar_reward_tiers').select('*').eq('org_id', orgId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Lazy-seed defaults if this org has none yet (e.g. created after migration ran)
  if (!data || data.length === 0) {
    const seedRows = REWARD_CATEGORIES.map(category => ({ org_id: orgId, category, ...DEFAULT_MATRIX[category] }))
    const { data: seeded } = await admin.from('pillar_reward_tiers').insert(seedRows).select()
    return NextResponse.json({ tiers: seeded ?? [] })
  }

  return NextResponse.json({ tiers: data })
}

export async function PATCH(req: NextRequest) {
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

  const { tiers }: { tiers: { id: string; revenue_min: number; revenue_max: number | null; t1_reward: number; t2_reward: number; t3_reward: number }[] } = body
  if (!Array.isArray(tiers)) return NextResponse.json({ error: 'tiers array required' }, { status: 400 })

  await Promise.all(tiers.map(t =>
    admin.from('pillar_reward_tiers').update({
      revenue_min: t.revenue_min,
      revenue_max: t.revenue_max,
      t1_reward: t.t1_reward,
      t2_reward: t.t2_reward,
      t3_reward: t.t3_reward,
    }).eq('id', t.id).eq('org_id', orgId)
  ))

  return NextResponse.json({ success: true })
}
