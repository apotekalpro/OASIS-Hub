import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = profile.data?.org_id
  if (!orgId) return NextResponse.json({ templates: [] })

  const { data, error } = await admin.from('pillar_templates')
    .select('*, departments(name), pillar_kr_templates(id, title, description, metric_type, start_value, target_value, unit, position)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
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
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })
  const featurePermissions = await getCachedFeaturePermissions(orgId)
  if (!role || !canManagePillarTemplates(role, featurePermissions)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { keyResults = [], ...fields } = body

  const { data: tpl, error } = await admin.from('pillar_templates').insert({
    org_id: orgId,
    created_by: user.id,
    title: fields.title,
    description: fields.description || null,
    dept_id: fields.dept_id || null,
    is_active: fields.is_active ?? true,
    incentive1_amount: fields.incentive1_amount ?? 0,
    incentive1_basis: fields.incentive1_basis ?? 'per_outlet',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (keyResults.length > 0) {
    await admin.from('pillar_kr_templates').insert(
      keyResults.map((kr: Record<string, unknown>, i: number) => ({
        template_id: tpl.id,
        title: kr.title,
        description: kr.description || null,
        metric_type: kr.metric_type || 'percentage',
        start_value: kr.start_value ?? 0,
        target_value: kr.target_value ?? 100,
        unit: kr.unit || null,
        position: i,
      }))
    )
  }

  return NextResponse.json({ template: tpl }, { status: 201 })
}
