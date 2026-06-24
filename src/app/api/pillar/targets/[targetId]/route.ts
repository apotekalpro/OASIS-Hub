import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ targetId: string }> }) {
  const { targetId } = await params
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

  const body = await req.json()
  const patch: Record<string, unknown> = {}
  if (body.category !== undefined) patch.category = String(body.category).toLowerCase()
  if (body.t1 !== undefined) patch.t1 = Number(body.t1) || 0
  if (body.t2 !== undefined) patch.t2 = Number(body.t2) || 0
  if (body.t3 !== undefined) patch.t3 = Number(body.t3) || 0
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const { data, error } = await admin.from('pillar_targets')
    .update(patch)
    .eq('id', targetId)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ target: data })
}
