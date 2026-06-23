import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { MapPin, Phone, Building2, Users } from 'lucide-react'
import { OutletManagementClient } from '@/components/inspections/outlet-management-client'
import { OutletImportClient } from '@/components/inspections/outlet-import-client'
import { OutletSyncClient } from '@/components/inspections/outlet-sync-client'

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

      {/* Outlets grid */}
      {outlets.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
            <Building2 className="h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-500">No outlets yet</p>
            <p className="text-sm text-gray-400">Add your first outlet to start scheduling inspections.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {outlets.map(outlet => (
            <Card key={outlet.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{outlet.name}</p>
                      {outlet.code && (
                        <p className="text-xs text-gray-400 font-mono">{outlet.code}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={outlet.status === 'active' ? 'success' : 'secondary'}>
                      {outlet.status}
                    </Badge>
                    <OutletManagementClient
                      orgId={orgId}
                      departments={departments}
                      users={users}
                      outlet={outlet}
                      mode="actions"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-500">
                  {(outlet.city || outlet.state) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{[outlet.city, outlet.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {outlet.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{outlet.phone}</span>
                    </div>
                  )}
                  {outlet.departments && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{outlet.departments.name}</span>
                    </div>
                  )}
                </div>

                {outlet.profiles && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                    <UserAvatar name={outlet.profiles.full_name} avatarUrl={outlet.profiles.avatar_url} size="sm" />
                    <span className="text-xs text-gray-500">Area Manager: <span className="font-medium text-gray-700">{outlet.profiles.full_name}</span></span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
