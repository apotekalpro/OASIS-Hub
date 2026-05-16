import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { canImportUsers } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || 'Alpro@123'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !canImportUsers(profile.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { users, org_id } = await request.json() as {
    users: Array<{
      email: string
      contact_email?: string
      full_name: string
      role: UserRole
      dept_id?: string
      employee_id?: string
      job_title?: string
      phone?: string
    }>
    org_id: string
  }

  if (!Array.isArray(users) || !org_id) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const results: { email: string; success: boolean; error?: string }[] = []

  for (const u of users) {
    try {
      let userId: string
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: u.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.full_name, role: u.role, must_change_password: true },
      })

      if (authError) {
        if (authError.message.toLowerCase().includes('already') || authError.message.toLowerCase().includes('exists')) {
          const { data: existing } = await adminClient.auth.admin.listUsers()
          const found = existing?.users?.find(eu => eu.email === u.email)
          if (!found) throw new Error(authError.message)
          userId = found.id
        } else {
          throw new Error(authError.message)
        }
      } else {
        userId = authUser.user.id
      }

      const { error: profileError } = await adminClient.from('profiles').upsert({
        id: userId,
        email: u.email,
        contact_email: u.contact_email || null,
        org_id,
        dept_id: u.dept_id || null,
        employee_id: u.employee_id || null,
        full_name: u.full_name,
        role: u.role,
        job_title: u.job_title || null,
        phone: u.phone || null,
        must_change_password: true,
      })

      if (profileError) throw new Error(profileError.message)
      results.push({ email: u.email, success: true })
    } catch (err) {
      results.push({ email: u.email, success: false, error: (err as Error).message })
    }
  }

  return NextResponse.json({ results })
}
