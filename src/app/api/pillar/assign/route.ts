import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import { sendEmail } from '@/lib/email/send'
import { pillarAssignedEmail } from '@/lib/email/templates'
import type { UserRole } from '@/types/database'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? 'https://oasishub.netlify.app'

export const dynamic = 'force-dynamic'

type Target = {
  scopeType: 'outlet' | 'all_outlets' | 'area_manager' | 'dept' | 'role' | 'person'
  outletId?: string
  userId?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: { user } }, body] = await Promise.all([
    supabase.auth.getUser(),
    req.json(),
  ])
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('org_id, role, full_name').eq('id', user.id).single()
  const orgId = profile.data?.org_id
  const role = profile.data?.role as UserRole | undefined
  const actorName = profile.data?.full_name ?? 'Someone'
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })
  const featurePermissions = await getCachedFeaturePermissions(orgId)
  if (!role || !canManagePillarTemplates(role, featurePermissions)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const {
    templateId = null,
    title,
    description = null,
    months = [],
    targets = [],
    keyResults = [],
    incentive1Amount = 0,
    incentive1Basis = 'per_outlet',
  }: { templateId: string | null; title: string; description: string | null; months: string[]; targets: Target[]; keyResults: Record<string, unknown>[]; incentive1Amount?: number; incentive1Basis?: 'per_outlet' | 'per_pax' } = body

  if (!title || months.length === 0 || targets.length === 0) {
    return NextResponse.json({ error: 'title, months, and targets are required' }, { status: 400 })
  }

  // Resolve template KR definitions and incentive1 (used unless caller passed explicit adhoc values)
  let krDefs = keyResults
  let incentive1amount = incentive1Amount
  let incentive1basis = incentive1Basis
  if (templateId) {
    const [{ data: tplKrs }, { data: tpl }] = await Promise.all([
      krDefs.length === 0
        ? admin.from('pillar_kr_templates').select('*').eq('template_id', templateId).order('position')
        : Promise.resolve({ data: null }),
      admin.from('pillar_templates').select('incentive1_amount, incentive1_basis').eq('id', templateId).single(),
    ])
    if (tplKrs) {
      krDefs = tplKrs.map(kr => ({
        title: kr.title,
        description: kr.description,
        metric_type: kr.metric_type,
        start_value: kr.start_value,
        target_value: kr.target_value,
        unit: kr.unit,
      }))
    }
    if (tpl) {
      incentive1amount = tpl.incentive1_amount
      incentive1basis = tpl.incentive1_basis
    }
  }

  // Look up outlet metadata (dept_id, area_manager_id) for outlet targets
  const outletIds = Array.from(new Set(targets.filter(t => t.outletId).map(t => t.outletId as string)))
  const { data: outletRows } = outletIds.length > 0
    ? await admin.from('outlets').select('id, dept_id, area_manager_id, name').in('id', outletIds)
    : { data: [] }
  const outletById = new Map((outletRows ?? []).map(o => [o.id, o]))

  const userIds = Array.from(new Set(targets.filter(t => t.userId).map(t => t.userId as string)))
  const { data: userRows } = userIds.length > 0
    ? await admin.from('profiles').select('id, dept_id, full_name, email, contact_email').in('id', userIds)
    : { data: [] }
  const userById = new Map((userRows ?? []).map(u => [u.id, u]))

  const batchId = crypto.randomUUID()
  const rows: Record<string, unknown>[] = []
  for (const month of months) {
    for (const t of targets) {
      const outlet = t.outletId ? outletById.get(t.outletId) : null
      rows.push({
        org_id: orgId,
        template_id: templateId,
        batch_id: batchId,
        title,
        description,
        month,
        scope_type: t.scopeType,
        outlet_id: t.outletId ?? null,
        assigned_to: t.userId ?? null,
        dept_id: outlet?.dept_id ?? (t.userId ? userById.get(t.userId)?.dept_id ?? null : null),
        area_manager_id: outlet?.area_manager_id ?? null,
        assigned_by: user.id,
        incentive1_amount: incentive1amount,
        incentive1_basis: incentive1basis,
      })
    }
  }

  const { data: inserted, error } = await admin.from('pillar_assignments').insert(rows).select('id, outlet_id, assigned_to, month')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (krDefs.length > 0 && inserted && inserted.length > 0) {
    await admin.from('pillar_assignment_krs').insert(
      inserted.flatMap(a => krDefs.map(kr => ({ ...kr, assignment_id: a.id })))
    )
  }

  // Fire-and-forget in-app notifications + emails to individually assigned users
  if (inserted && inserted.length > 0) {
    const notifyUserIds = Array.from(new Set(inserted.filter(a => a.assigned_to).map(a => a.assigned_to as string)))
    if (notifyUserIds.length > 0) {
      Promise.resolve().then(async () => {
        const monthLabel = months[0] ? new Date(months[0] + 'T00:00:00').toLocaleDateString('en-MY', { month: 'long', year: 'numeric' }) : undefined

        await admin.from('notifications').insert(
          notifyUserIds.map(uid => ({
            user_id: uid,
            type: 'pillar_assigned',
            title: `${actorName} assigned you a Pillar: ${title}`,
            body: monthLabel ? `For ${monthLabel}` : null,
            data: { url: `${APP_URL}/pillar` },
          }))
        ).then(({ error }) => { if (error) console.error(error) })

        for (const uid of notifyUserIds) {
          const r = userById.get(uid)
          const to = r?.contact_email || r?.email
          if (!to) continue
          const tpl = pillarAssignedEmail({
            recipientName: r?.full_name ?? 'there',
            pillarTitle: title,
            assignedBy: actorName,
            month: monthLabel,
            pillarUrl: `${APP_URL}/pillar`,
          })
          sendEmail({ to, subject: tpl.subject, html: tpl.html }).catch(() => {})
        }
      }).catch(() => {})
    }
  }

  return NextResponse.json({ assignments: inserted ?? [], batchId }, { status: 201 })
}
