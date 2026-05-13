import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DepartmentManagementClient } from '@/components/admin/department-management-client'

export default async function DepartmentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [deptResult, profileResult] = await Promise.all([
    supabase
      .from('departments')
      .select('*, parent:parent_id(name)')
      .order('name'),
    supabase.from('profiles').select('org_id').eq('id', user.id).single(),
  ])
  const departments = deptResult.data as Array<{
    id: string; org_id: string; parent_id: string | null; name: string;
    description: string | null; color: string; created_at: string; updated_at: string;
    parent?: { name: string } | null
  }> | null
  const orgId = profileResult.data?.org_id ?? ''

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your organizational structure and departments.</p>
        </div>
        <DepartmentManagementClient
          departments={departments ?? []}
          orgId={orgId}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Departments ({departments?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">Department</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Parent</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {departments?.map(dept => (
                <tr key={dept.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: dept.color }}
                      />
                      <div>
                        <p className="font-medium text-gray-900">{dept.name}</p>
                        {dept.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{dept.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-500">
                    {(dept as { parent?: { name: string } | null }).parent?.name ?? '— Root —'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DepartmentManagementClient
                      departments={departments}
                      orgId={orgId}
                      dept={dept}
                      mode="actions"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
