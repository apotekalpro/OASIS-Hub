import { createAdminClient } from '@/lib/supabase/server'
import { OkrListClient } from '@/components/okr/okr-list-client'
import { OkrForm } from '@/components/okr/okr-form'
import type { PickerUser } from '@/components/ui/assignee-picker'
import type { UserRole } from '@/types/database'
import { getAuthUser, getCachedProfile } from '@/lib/auth/get-user-profile'

type PickerTeam = { id: string; name: string; team_members?: Array<{ user_id: string; profiles?: PickerUser | null }> }

export const dynamic = 'force-dynamic'

export default async function OkrPage() {
  const admin = createAdminClient()
  const user = await getAuthUser()
  if (!user) return null

  const profile = await getCachedProfile(user.id)
  const orgId = (profile?.org_id ?? '') as string
  const role = (profile?.role ?? 'member') as UserRole

  const isAdmin = ['super_admin', 'org_admin'].includes(role)

  // Non-admins only see objectives they created, are assigned to, or are watching
  let visibleOkrIds: string[] | null = null
  if (!isAdmin) {
    const [assignedRes, watchedRes, createdRes] = await Promise.all([
      admin.from('okr_assignees').select('objective_id').eq('user_id', user.id),
      admin.from('okr_watchers').select('objective_id').eq('user_id', user.id),
      admin.from('okr_objectives').select('id').eq('created_by', user.id).eq('org_id', orgId),
    ])
    visibleOkrIds = [...new Set([
      ...(assignedRes.data ?? []).map(r => r.objective_id),
      ...(watchedRes.data ?? []).map(r => r.objective_id),
      ...(createdRes.data ?? []).map(r => r.id),
    ])]
  }

  const [objectivesRes, usersRes, deptsRes, teamsRes] = await Promise.all([
    (() => {
      let q = admin
        .from('okr_objectives')
        .select('*, departments(name), teams(name), okr_key_results(id, title, metric_type, start_value, target_value, current_value, unit, status, due_date), okr_assignees(user_id, role), okr_watchers(user_id)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
      if (visibleOkrIds !== null) {
        if (visibleOkrIds.length === 0) return Promise.resolve({ data: [] })
        q = q.in('id', visibleOkrIds)
      }
      return q
    })(),
    admin.from('profiles').select('id, full_name, email, avatar_url, dept_id, role').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    admin.from('departments').select('id, name').eq('org_id', orgId).order('name'),
    admin.from('teams').select('id, name, team_members(user_id, profiles(id, full_name, email, avatar_url, dept_id, role))').eq('org_id', orgId).order('name'),
  ])

  const canCreate = ['super_admin', 'org_admin', 'dept_head', 'chief', 'lead', 'area_manager', 'team_leader', 'member'].includes(role)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OKRs</h1>
          <p className="text-gray-500 text-sm mt-0.5">Objectives &amp; Key Results — track what matters most</p>
        </div>
        {canCreate && (
          <OkrForm
            orgId={orgId}
            currentUserId={user.id}
            users={(usersRes.data ?? []) as unknown as PickerUser[]}
            departments={deptsRes.data ?? []}
            teams={(teamsRes.data ?? []) as unknown as PickerTeam[]}
          />
        )}
      </div>
      <OkrListClient
        initialObjectives={objectivesRes.data ?? []}
        orgId={orgId}
        currentUserId={user.id}
        users={usersRes.data ?? []}
        departments={deptsRes.data ?? []}
        teams={teamsRes.data ?? []}
      />
    </div>
  )
}
