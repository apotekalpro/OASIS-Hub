'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/email/send'
import { welcomeUserEmail } from '@/lib/email/templates'
import type { UserRole } from '@/types/database'

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || 'Alpro@123'

// ─── Create a single user (SuperAdmin / OrgAdmin) ────────────────────────────
export async function createUser(data: {
  email: string
  contact_email?: string | null
  full_name: string
  role: UserRole
  org_id: string
  dept_id?: string
  chief_dept_ids?: string[]
  outlet_id?: string | null
  employee_id?: string
  job_title?: string
  phone?: string
}): Promise<{ success: true; userId: string } | { success: false; error: string }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to your Netlify environment variables.' }
  }

  const adminClient = createAdminClient()

  // Try to create auth user; if already exists, look up their existing ID
  let userId: string
  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: data.full_name, role: data.role, must_change_password: true },
  })

  if (authError) {
    if (authError.message.toLowerCase().includes('already') || authError.message.toLowerCase().includes('exists')) {
      const { data: existing } = await adminClient.auth.admin.listUsers()
      const found = existing?.users?.find(u => u.email === data.email)
      if (!found) return { success: false, error: authError.message }
      userId = found.id
    } else {
      return { success: false, error: authError.message }
    }
  } else {
    userId = authUser.user.id
  }

  // For chiefs, dept_id on profile = first selected dept (for backwards compat)
  const profileDeptId = data.role === 'chief' && data.chief_dept_ids?.length
    ? data.chief_dept_ids[0]
    : data.dept_id || null

  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: userId,
      email: data.email,
      contact_email: data.contact_email || null,
      org_id: data.org_id,
      dept_id: profileDeptId,
      employee_id: data.employee_id || null,
      full_name: data.full_name,
      role: data.role,
      job_title: data.job_title || null,
      phone: data.phone || null,
      outlet_id: data.outlet_id || null,
      must_change_password: true,
    })

  if (profileError) return { success: false, error: profileError.message }

  // Handle multi-department assignments for chiefs
  if (data.role === 'chief') {
    await adminClient.from('chief_departments').delete().eq('user_id', userId)
    for (const deptId of (data.chief_dept_ids ?? [])) {
      const { error: insErr } = await adminClient.from('chief_departments').insert({ user_id: userId, dept_id: deptId })
      if (insErr) return { success: false, error: `Failed to assign department: ${insErr.message}` }
    }
  }

  revalidatePath('/admin/users')
  return { success: true, userId }
}

// ─── Bulk import users from CSV data ─────────────────────────────────────────
export async function importUsers(
  users: Array<{
    email: string
    contact_email?: string
    full_name: string
    role: UserRole
    dept_id?: string
    employee_id?: string
    job_title?: string
    phone?: string
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
  const adminClient = createAdminClient()

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
export async function toggleUserActive(userId: string, isActive: boolean): Promise<{ success: true } | { success: false; error: string }> {
  const adminClient = createAdminClient()

  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: isActive ? 'none' : '876600h',
  })
  if (authError) return { success: false, error: authError.message }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)
  if (profileError) return { success: false, error: profileError.message }

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
    contact_email: string | null
    chief_dept_ids: string[]
    outlet_id: string | null
    employee_id: string
    job_title: string
    phone: string
  }>
): Promise<{ success: true } | { success: false; error: string }> {
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { chief_dept_ids, ...profileData } = data as typeof data & { email?: string }
  // email lives in auth.users, not profiles — strip it to avoid update errors
  const { email: _email, ...safeProfileData } = profileData as typeof profileData & { email?: string }

  // For chiefs, set dept_id to the first selected dept so the profile column is populated
  if (data.role === 'chief' && chief_dept_ids?.length) {
    (safeProfileData as typeof safeProfileData & { dept_id?: string }).dept_id = chief_dept_ids[0]
  }

  const { error } = await adminClient
    .from('profiles')
    .update(safeProfileData)
    .eq('id', userId)

  if (error) return { success: false, error: error.message }

  // Sync chief_departments when role is chief or being cleared
  if (data.role === 'chief') {
    await adminClient.from('chief_departments').delete().eq('user_id', userId)
    for (const deptId of (chief_dept_ids ?? [])) {
      const { error: insErr } = await adminClient.from('chief_departments').insert({ user_id: userId, dept_id: deptId })
      if (insErr) return { success: false, error: `Failed to assign department: ${insErr.message}` }
    }
  } else if (data.role) {
    // Role changed away from chief — clear their department assignments
    await adminClient.from('chief_departments').delete().eq('user_id', userId)
  }

  revalidatePath('/admin/users')
  return { success: true }
}

// ─── Sign in ──────────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    const msg = error.message.toLowerCase().includes('ban')
      ? 'Your account has been deactivated. Please contact your system administrator.'
      : error.message
    return { success: false, error: msg }
  }

  // Update last login (best-effort, don't block on failure)
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

// ─── Create a custom role ─────────────────────────────────────────────────────
export async function createCustomRole(data: {
  slug: string
  label: string
  level: number
  color: string
  org_id: string
}) {
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('roles').insert({
    slug: data.slug,
    label: data.label,
    level: data.level,
    color: data.color,
    is_system: false,
    org_id: data.org_id,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/roles')
  return { success: true }
}

// ─── Update a custom role ─────────────────────────────────────────────────────
export async function updateCustomRole(slug: string, data: {
  label: string
  level: number
  color: string
}) {
  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('roles')
    .update({ label: data.label, level: data.level, color: data.color })
    .eq('slug', slug)
    .eq('is_system', false)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/roles')
  return { success: true }
}

// ─── Delete a custom role ─────────────────────────────────────────────────────
export async function deleteCustomRole(slug: string) {
  const adminClient = createAdminClient()

  // Check no profiles use this role
  const { count } = await adminClient
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', slug)

  if (count && count > 0) {
    throw new Error(`Cannot delete: ${count} user${count === 1 ? '' : 's'} have this role`)
  }

  const { error } = await adminClient
    .from('roles')
    .delete()
    .eq('slug', slug)
    .eq('is_system', false)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/roles')
  return { success: true }
}

// ─── Send invitation email to an existing user ────────────────────────────────
export async function sendUserInvite(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, contact_email, full_name')
    .eq('id', userId)
    .single()

  if (!profile?.email) throw new Error('User not found')

  // Use contact_email for delivery if set, otherwise fall back to login email
  const deliveryEmail = profile.contact_email || profile.email

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? 'https://oasishub.netlify.app'
  const tpl = welcomeUserEmail({
    recipientName: profile.full_name,
    email: profile.email,
    defaultPassword: DEFAULT_PASSWORD,
    loginUrl: `${appUrl}/login`,
  })

  const result = await sendEmail({ to: deliveryEmail, subject: tpl.subject, html: tpl.html })
  if (!result.success && !result.skipped) throw new Error('Failed to send email')
}
