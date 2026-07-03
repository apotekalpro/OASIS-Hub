import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Building2 } from 'lucide-react'
import { OutletManagementClient } from '@/components/inspections/outlet-management-client'
import { OutletImportClient } from '@/components/inspections/outlet-import-client'
import { OutletSyncClient } from '@/components/inspections/outlet-sync-client'
import { OutletFilterClient } from '@/components/inspections/outlet-filter-client'

export default async function OutletsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single()
  const orgId = profileRes.data?.org_id ?? ''
  const isSuperAdmin = profileRes.data?.role === 'super_admin'

  const outletsQuery = supabase
    .from('outlets')
    .select(`*, profiles!outlets_area_manager_id_fkey(id, full_name, avatar_url), departments(name)`)
    .ilike('name', '%Apotek Alpro%')
    .order('name')
  if (!isSuperAdmin && orgId) outletsQuery.eq('org_id', orgId)

  const deptsQuery = supabase.from('departments').select('id, name').order('name')
  if (!isSuperAdmin && orgId) deptsQuery.eq('org_id', orgId)

  const usersQuery = supabase.from('profiles').select('id, full_name, email, avatar_url').eq('is_active', true).eq('role', 'area_manager').order('full_name')
  if (!isSuperAdmin && orgId) usersQuery.eq('org_id', orgId)

  const [outletsRes, deptsRes, usersRes] = await Promise.all([outletsQuery, deptsQuery, usersQuery])

  type OutletRow = {
    id: string; name: string; code: string | null; address: string | null; city: string | null
    state: string | null; phone: string | null; status: string; created_at: string
    area_manager_id: string | null
    profiles?: { id: string; full_name: string; avatar_url: string | null } | null
    departments?: { name: string } | null
  }

  const outlets = (outletsRes.data ?? []) as OutletRow[]
  const departments = deptsRes.data ?? []
  const users = usersRes.data ?? []

  const stats = {
    active: outlets.filter(o => o.status === 'active').length,
    inactive: outlets.filter(o => o.status === 'inactive').length,
    total: outlets.length,
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outlets / Stores</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Manage pharmacy outlets, assign staff, and configure inspection coverage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OutletSyncClient />
          <OutletImportClient orgId={orgId} />
          <OutletManagementClient
            orgId={orgId}
            departments={departments}
            users={users}
            mode="create"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-500">Total Outlets</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          <p className="text-sm text-gray-500">Active</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold text-gray-400">{stats.inactive}</p>
          <p className="text-sm text-gray-500">Inactive</p>
        </CardContent></Card>
      </div>

      {outlets.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
            <Building2 className="h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-500">No outlets yet</p>
            <p className="text-sm text-gray-400">Add your first outlet to start scheduling inspections.</p>
          </CardContent>
        </Card>
      ) : (
        <OutletFilterClient outlets={outlets} departments={departments} users={users} orgId={orgId} />
      )}
    </div>
  )
}
