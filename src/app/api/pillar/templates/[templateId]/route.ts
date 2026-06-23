import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await admin.from('pillar_templates')
    .select('*, departments(name), pillar_kr_templates(*)')
    .eq('id', templateId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ template: data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: { user } }, body] = await Promise.all([
    supabase.auth.getUser(),
    req.json(),
  ])
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('role').eq('id', user.id).single()
  const role = profile.data?.role as UserRole | undefined
  if (!role || !canManagePillarTemplates(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { keyResults, ...fields } = body
  type KRPayload = { id?: string; [key: string]: unknown }
  const krsArray = Array.isArray(keyResults) ? (keyResults as KRPayload[]) : null
  const existingKrs = krsArray?.filter(kr => kr.id) ?? []
  const newKrs = krsArray?.filter(kr => !kr.id) ?? []
  const keptKrIds = existingKrs.map(kr => kr.id as string)

  const [updateResult] = await Promise.all([
    Object.keys(fields).length > 0
      ? admin.from('pillar_templates').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', templateId)
      : Promise.resolve({ error: null }),
    krsArray
      ? keptKrIds.length > 0
        ? admin.from('pillar_kr_templates').delete().eq('template_id', templateId).not('id', 'in', `(${keptKrIds.join(',')})`)
        : admin.from('pillar_kr_templates').delete().eq('template_id', templateId)
      : Promise.resolve(null),
  ])

  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 })

  await Promise.all([
    ...existingKrs.map(kr => {
      const { id, ...krFields } = kr
      return admin.from('pillar_kr_templates').update(krFields).eq('id', id as string)
    }),
    newKrs.length > 0
      ? admin.from('pillar_kr_templates').insert(
          newKrs.map((kr, i) => ({ ...kr, template_id: templateId, position: existingKrs.length + i }))
        )
      : Promise.resolve(null),
  ])

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('role').eq('id', user.id).single()
  const role = profile.data?.role as UserRole | undefined
  if (!role || !canManagePillarTemplates(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('pillar_templates').delete().eq('id', templateId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
