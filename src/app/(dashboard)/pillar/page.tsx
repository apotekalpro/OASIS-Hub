import { createAdminClient } from '@/lib/supabase/server'
import { PillarListClient } from '@/components/pillar/pillar-list-client'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'
import { getAuthUser, getCachedProfile, getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'

export const dynamic = 'force-dynamic'

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function PillarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams
  const month = monthParam ?? currentMonth()

  const admin = createAdminClient()
  const user = await getAuthUser()
  if (!user) return null

  const profile = await getCachedProfile(user.id)
  const orgId = (profile?.org_id ?? '') as string
  const role = (profile?.role ?? 'member') as UserRole
  const profileOutletId = (profile as { outlet_id?: string | null } | null)?.outlet_id ?? null

  let query = admin.from('pillar_assignments')
    .select('*, outlets(name, code), profiles!pillar_assignments_assigned_to_fkey(full_name, avatar_url), area_manager:profiles!pillar_assignments_area_manager_id_fkey(id, full_name), departments(name), pillar_assignment_krs(id, title, metric_type, start_value, target_value, current_value, status)')
    .eq('org_id', orgId)
    .eq('month', month)
    .order('created_at', { ascending: false })

  const featurePermissions = await getCachedFeaturePermissions(orgId)
  const isAdmin = canManagePillarTemplates(role, featurePermissions)
  if (!isAdmin) {
    if (role === 'area_manager') {
      query = query.or(`assigned_to.eq.${user.id},area_manager_id.eq.${user.id}`)
    } else {
      const visibleOutletIds = new Set<string>()
      if (profileOutletId) visibleOutletIds.add(profileOutletId)
      const { data: staffRows } = await admin.from('outlet_staff').select('outlet_id').eq('user_id', user.id)
      for (const r of staffRows ?? []) if (r.outlet_id) visibleOutletIds.add(r.outlet_id)

      const orParts = [`assigned_to.eq.${user.id}`]
      if (visibleOutletIds.size > 0) orParts.push(`outlet_id.in.(${Array.from(visibleOutletIds).join(',')})`)
      query = query.or(orParts.join(','))
    }
  }

  const { data: assignments } = await query

  // Resolve the outlet(s) this user reports rewards for (used by the gamification banner).
  // Area managers see rewards aggregated across every outlet they manage.
  let rewardOutletIds: string[] = []
  if (role === 'area_manager') {
    const { data: amOutlets } = await admin.from('outlets').select('id').eq('area_manager_id', user.id).ilike('name', '%Apotek Alpro%').order('name')
    rewardOutletIds = (amOutlets ?? []).map(o => o.id)
  } else if (profileOutletId) {
    rewardOutletIds = [profileOutletId]
  } else {
    const { data: staffOutlet } = await admin.from('outlet_staff').select('outlet_id').eq('user_id', user.id).limit(1).maybeSingle()
    if (staffOutlet?.outlet_id) rewardOutletIds = [staffOutlet.outlet_id]
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alpro Pillar</h1>
        <p className="text-gray-500 text-sm mt-0.5">Your assigned Pillars, Key Results, and progress for the month</p>
      </div>
      <PillarListClient initialAssignments={assignments ?? []} initialMonth={month} rewardOutletIds={rewardOutletIds} canDelete={isAdmin} isElevated={isAdmin || role === 'area_manager'} />
    </div>
  )
}
