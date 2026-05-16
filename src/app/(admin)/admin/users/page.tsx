import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth/permissions'
import { formatDate } from '@/lib/utils'
import { UserManagementClient } from '@/components/admin/user-management-client'
import type { UserRole } from '@/types/database'

export default async function UsersPage() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await adminSupabase.from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = profileRes.data?.org_id ?? null

  let profilesQuery = adminSupabase.from('profiles').select(`*, chief_departments(dept_id)`).order('created_at', { ascending: false })
  let deptsQuery = adminSupabase.from('departments').select('id, name, org_id').order('name')
  if (orgId) {
    profilesQuery = profilesQuery.eq('org_id', orgId)
    deptsQuery = deptsQuery.eq('org_id', orgId)
  }

  const [usersResult, deptsResult] = await Promise.all([profilesQuery, deptsQuery])
  const users = usersResult.data as Array<{
    id: string; full_name: string; email: string; contact_email: string | null; role: UserRole; is_active: boolean;
    must_change_password: boolean; employee_id: string | null; avatar_url: string | null;
    dept_id: string | null; created_at: string; job_title: string | null; phone: string | null;
    last_login_at: string | null;
    departments?: { name: string } | null
    chief_departments?: Array<{ dept_id: string }> | null
  }> | null
  const departments = deptsResult.data as Array<{ id: string; name: string; org_id: string }> | null

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
          orgId={orgId ?? ''}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['super_admin', 'org_admin', 'dept_head', 'chief', 'lead', 'member'] as UserRole[]).map(role => (
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

      {/* Users table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Users ({users?.length ?? 0})</CardTitle>
          <CardDescription>
            Active users in your organization. Default password: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Alpro@123</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Joined</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Last Login</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users?.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={user.full_name} avatarUrl={user.avatar_url} size="sm" />
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                          {user.contact_email && (
                            <p className="text-xs text-indigo-500">{user.contact_email} <span className="text-gray-300">(contact)</span></p>
                          )}
                          {user.employee_id && (
                            <p className="text-xs text-gray-400">ID: {user.employee_id}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role as UserRole]}`}>
                        {ROLE_LABELS[user.role as UserRole]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-500">
                      {departments?.find(d => d.id === user.dept_id)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <Badge variant={user.is_active ? 'success' : 'destructive'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {user.must_change_password && (
                          <Badge variant="warning" className="text-xs">
                            Pending PW
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-4 py-4 text-gray-500">
                      {user.last_login_at ? formatDate(user.last_login_at) : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <UserManagementClient
                        userId={user.id}
                        user={user}
                        departments={departments ?? []}
                        orgId={orgId}
                        initialChiefDeptIds={user.chief_departments?.map(cd => cd.dept_id) ?? []}
                        mode="actions"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
