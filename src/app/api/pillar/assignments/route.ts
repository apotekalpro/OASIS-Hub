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

  const profileRes = await admin.from('profiles').select('org_id, role, outlet_id').eq('id', user.id).single()
  const { org_id: orgId, role, outlet_id: profileOutletId } = (profileRes.data ?? {}) as { org_id: string; role: UserRole; outlet_id: string | null }
  if (!orgId) return NextResponse.json({ assignments: [] })

  const month = req.nextUrl.searchParams.get('month')

  let query = admin.from('pillar_assignments')
    .select('*, outlets(name, code), profiles!pillar_assignments_assigned_to_fkey(full_name, avatar_url), departments(name), pillar_assignment_krs(id, title, metric_type, start_value, target_value, current_value, unit, status, due_date)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (month) query = query.eq('month', month)

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

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignments: data ?? [] })
}
