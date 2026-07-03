import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateEmbedToken } from '@/lib/embed-token'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await admin.from('profiles').select('org_id, role').eq('id', user.id).single()
  const orgId = profile.data?.org_id
  const role = profile.data?.role as UserRole | undefined
  if (!orgId || !role) return NextResponse.json({ error: 'No org' }, { status: 400 })

  if (role !== 'org_admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token = generateEmbedToken(orgId)
  return NextResponse.json({ token })
}
