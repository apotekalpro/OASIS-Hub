import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { UserManagementClient } from '@/components/admin/user-management-client'
import { UsersTableClient } from '@/components/admin/users-table-client'
import type { UserRole } from '@/types/database'

export default async function UsersPage() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await adminSupabase.from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = profileRes.data?.org_id ?? null

  let profilesQuery = adminSupabase.from('profiles').select('*').order('created_at', { ascending: false })
  let deptsQuery = adminSupabase.from('departments').select('id, name, org_id').order('name')
  let outletsQuery = adminSupabase.from('outlets').select('id, name, code').eq('status', 'active').order('name')
  if (orgId) {
    profilesQuery = profilesQuery.eq('org_id', orgId)
    deptsQuery = deptsQuery.eq('org_id', orgId)
    outletsQuery = outletsQuery.eq('org_id', orgId)
  }

  const rolesQuery = adminSupabase.from('roles').select('slug, label, level, is_system').order('level', { ascending: false })
  const [usersResult, deptsResult, outletsResult, rolesResult] = await Promise.all([profilesQuery, deptsQuery, outletsQuery, rolesQuery])
  const rawUsers = usersResult.data as Array<{
    id: string; full_name: string; email: string; contact_email: string | null; role: UserRole; is_active: boolean;
    must_change_password: boolean; employee_id: string | null; avatar_url: string | null;
    dept_id: string | null; outlet_id: string | null; created_at: string; job_title: string | null; phone: string | null;
    last_login_at: string | null;
  }> | null
  const departments = deptsResult.data as Array<{ id: string; name: string; org_id: string }> | null
  const outlets = outletsResult.data as Array<{ id: string; name: string; code: string | null }> | null
  const rolesData = rolesResult.data as Array<{ slug: string; label: string; level: number; is_system: boolean }> | null

  // Fetch chief_departments separately to avoid PostgREST join issues
  const chiefUserIds = (rawUsers ?? []).filter(u => u.role === 'chief').map(u => u.id)
  const chiefDeptsMap = new Map<string, string[]>()
  if (chiefUserIds.length > 0) {
    const { data: cdRows } = await adminSupabase.from('chief_departments').select('user_id, dept_id').in('user_id', chiefUserIds)
    for (const row of (cdRows ?? []) as Array<{ user_id: string; dept_id: string }>) {
      if (!chiefDeptsMap.has(row.user_id)) chiefDeptsMap.set(row.user_id, [])
      chiefDeptsMap.get(row.user_id)!.push(row.dept_id)
    }
  }

  const users = (rawUsers ?? []).map(u => ({
    ...u,
    chief_departments: (chiefDeptsMap.get(u.id) ?? []).map(deptId => ({ dept_id: deptId })),
  }))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Manage users, roles, and access. New users get the default password.
          </p>
        </div>
        <UserManagementClient
          departments={departments ?? []}
          outlets={outlets ?? []}
          orgId={orgId ?? ''}
          roles={rolesData ?? []}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['super_admin', 'org_admin', 'dept_head', 'chief', 'lead', 'area_manager', 'member', 'outlet'] as UserRole[]).map(role => (
          <Card key={role}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-gray-900">
                {users?.filter(u => u.role === role).length ?? 0}
              </p>
              <p className="text-sm text-gray-500">{ROLE_LABELS[role]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users table with search/filter */}
      <UsersTableClient
        users={users}
        departments={departments ?? []}
        outlets={outlets ?? []}
        rolesData={rolesData ?? []}
        orgId={orgId}
      />
    </div>
  )
}
