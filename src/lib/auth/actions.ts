'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/types/database'

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || 'Alpro@123'

// ─── Create a single user (SuperAdmin / OrgAdmin) ────────────────────────────
export async function createUser(data: {
  email: string
  full_name: string
  role: UserRole
  org_id: string
  dept_id?: string
  employee_id?: string
  job_title?: string
  phone?: string
}) {
  const adminClient = await createAdminClient()

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: data.full_name,
      role: data.role,
      must_change_password: true,
    },
  })

  if (authError) throw new Error(authError.message)

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      org_id: data.org_id,
      dept_id: data.dept_id ?? null,
      employee_id: data.employee_id ?? null,
      full_name: data.full_name,
      role: data.role,
      job_title: data.job_title ?? null,
      phone: data.phone ?? null,
      must_change_password: true,
    })
    .eq('id', authUser.user.id)

  if (profileError) throw new Error(profileError.message)

  revalidatePath('/admin/users')
  return { success: true, userId: authUser.user.id }
}

// ─── Bulk import users from CSV data ─────────────────────────────────────────
export async function importUsers(
  users: Array<{
    email: string
    full_name: string
    role: UserRole
    dept_id?: string
    employee_id?: string
    job_title?: string
  }>,
  org_id: string
) {
  const results: { email: string; success: boolean; error?: string }[] = []

  for (const user of users) {
    try {
      await createUser({ ...user, org_id })
      results.push({ email: user.email, success: true })
    } catch (err) {
      results.push({ email: user.email, success: false, error: (err as Error).message })
    }
  }

  revalidatePath('/admin/users')
  return results
}

// ─── Reset user password to default ──────────────────────────────────────────
export async function resetUserPassword(userId: string) {
  const adminClient = await createAdminClient()

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: DEFAULT_PASSWORD,
  })

  if (error) throw new Error(error.message)

  await adminClient
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', userId)

  revalidatePath('/admin/users')
  return { success: true }
}

// ─── Change own password (user action) ───────────────────────────────────────
export async function changePassword(newPassword: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id)
  }

  return { success: true }
}

// ─── Toggle user active status ────────────────────────────────────────────────
export async function toggleUserActive(userId: string, isActive: boolean) {
  const adminClient = await createAdminClient()

  await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: isActive ? 'none' : '876600h',
  })

  await adminClient
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)

  revalidatePath('/admin/users')
  return { success: true }
}

// ─── Update user profile/role ─────────────────────────────────────────────────
export async function updateUserProfile(
  userId: string,
  data: Partial<{
    full_name: string
    role: UserRole
    dept_id: string
    employee_id: string
    job_title: string
    phone: string
  }>
) {
  const adminClient = await createAdminClient()

  const { error } = await adminClient
    .from('profiles')
    .update(data)
    .eq('id', userId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
  return { success: true }
}

// ─── Sign in ──────────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)

  // Update last login
  await supabase
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.user.id)

  return { success: true }
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
