import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RolesClient } from '@/components/admin/roles-client'
import type { Role } from '@/types/database'

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'org_admin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const orgId = profile.org_id as string

  // Fetch all roles (system + custom for this org)
  const { data: rolesData } = await adminClient
    .from('roles')
    .select('*')
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .order('level', { ascending: false })

  // Fetch user count per role for this org
  const { data: roleCountRows } = await adminClient
    .from('profiles')
    .select('role')
    .eq('org_id', orgId)

  const roleCounts: Record<string, number> = {}
  for (const row of roleCountRows ?? []) {
    const r = row.role as string
    roleCounts[r] = (roleCounts[r] ?? 0) + 1
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <RolesClient
        roles={(rolesData as Role[]) ?? []}
        roleCounts={roleCounts}
        orgId={orgId}
        currentUserRole={profile.role}
      />
    </div>
  )
}
