import { createClient, createAdminClient } from '@/lib/supabase/server'
import { OkrListClient } from '@/components/okr/okr-list-client'
import { OkrForm } from '@/components/okr/okr-form'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function OkrPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await admin.from('profiles').select('org_id, full_name, role').eq('id', user.id).single()
  const { org_id: orgId, role } = (profileRes.data ?? {}) as { org_id: string; full_name: string; role: UserRole }

  const [objectivesRes, usersRes, deptsRes, teamsRes] = await Promise.all([
    admin
      .from('okr_objectives')
      .select('*, departments(name), teams(name), okr_key_results(id, title, metric_type, start_value, target_value, current_value, unit, status, due_date), okr_assignees(user_id, role), okr_watchers(user_id)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    admin.from('profiles').select('id, full_name, email, avatar_url').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    admin.from('departments').select('id, name').eq('org_id', orgId).order('name'),
    admin.from('teams').select('id, name').eq('org_id', orgId).order('name'),
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
            users={usersRes.data ?? []}
            departments={deptsRes.data ?? []}
            teams={teamsRes.data ?? []}
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
