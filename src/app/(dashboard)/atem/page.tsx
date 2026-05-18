import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AtemListClient } from '@/components/atem/atem-list-client'
import { AtemForm } from '@/components/atem/atem-form'
import type { PickerUser } from '@/components/ui/assignee-picker'
import type { UserRole } from '@/types/database'

type PickerTeam = { id: string; name: string; team_members?: Array<{ user_id: string; profiles?: PickerUser | null }> }

export const dynamic = 'force-dynamic'

export default async function AtemPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await admin.from('profiles').select('org_id, full_name, role').eq('id', user.id).single()
  const { org_id: orgId, role } = (profileRes.data ?? {}) as { org_id: string; full_name: string; role: UserRole }

  const isAdmin = ['super_admin', 'org_admin'].includes(role)

  // Non-admins only see items they created, are assigned to, or are watching
  let visibleAtemIds: string[] | null = null
  if (!isAdmin) {
    const [assignedRes, watchedRes, createdRes] = await Promise.all([
      admin.from('atem_assignees').select('atem_id').eq('user_id', user.id),
      admin.from('atem_watchers').select('atem_id').eq('user_id', user.id),
      admin.from('atem_items').select('id').eq('created_by', user.id).eq('org_id', orgId),
    ])
    visibleAtemIds = [...new Set([
      ...(assignedRes.data ?? []).map(r => r.atem_id),
      ...(watchedRes.data ?? []).map(r => r.atem_id),
      ...(createdRes.data ?? []).map(r => r.id),
    ])]
  }

  const [itemsRes, usersRes, deptsRes, teamsRes] = await Promise.all([
    (() => {
      let q = admin.from('atem_items')
        .select('*, departments(name), teams(name), atem_assignees(user_id), atem_watchers(user_id)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
      if (visibleAtemIds !== null) {
        if (visibleAtemIds.length === 0) return Promise.resolve({ data: [] })
        q = q.in('id', visibleAtemIds)
      }
      return q
    })(),
    admin.from('profiles').select('id, full_name, email, avatar_url, dept_id, role').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    admin.from('departments').select('id, name').eq('org_id', orgId).order('name'),
    admin.from('teams').select('id, name, team_members(user_id, profiles(id, full_name, email, avatar_url, dept_id, role))').eq('org_id', orgId).order('name'),
  ])

  const canCreate = ['super_admin', 'org_admin', 'dept_head', 'chief', 'lead', 'area_manager', 'team_leader'].includes(role)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ATEM</h1>
          <p className="text-gray-500 text-sm mt-0.5">Alpro Task Entry Model (ATEM) — T·D·I·D·S·C·E</p>
        </div>
        {canCreate && (
          <AtemForm
            orgId={orgId}
            currentUserId={user.id}
            users={(usersRes.data ?? []) as unknown as PickerUser[]}
            departments={deptsRes.data ?? []}
            teams={(teamsRes.data ?? []) as unknown as PickerTeam[]}
          />
        )}
      </div>
      <AtemListClient
        initialItems={itemsRes.data ?? []}
        orgId={orgId}
        currentUserId={user.id}
        users={usersRes.data ?? []}
        departments={deptsRes.data ?? []}
        teams={teamsRes.data ?? []}
      />
    </div>
  )
}
