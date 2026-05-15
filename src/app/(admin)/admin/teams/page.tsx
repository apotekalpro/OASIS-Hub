import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TeamsClient } from '@/components/teams/teams-client'
import { Globe, Lock } from 'lucide-react'
import type { Profile } from '@/types/database'

export default async function AdminTeamsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profileRes, teamsRes, deptsRes, usersRes] = await Promise.all([
    supabase.from('profiles').select('org_id, role').eq('id', user.id).single(),
    supabase.from('teams').select(`
      id, name, description, color, is_private, created_at, dept_id,
      departments(name),
      team_members(user_id, role, profiles(full_name))
    `).order('name'),
    supabase.from('departments').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name, avatar_url, email').eq('is_active', true).order('full_name'),
  ])

  const profile = profileRes.data as Pick<Profile, 'org_id' | 'role'> | null
  type OrgUser = { id: string; full_name: string; avatar_url: string | null; email: string }
  const orgUsers = (usersRes.data ?? []) as OrgUser[]

  type TeamRow = {
    id: string; name: string; description: string | null; color: string;
    is_private: boolean; created_at: string; dept_id: string | null; created_by: string | null;
    departments?: { name: string } | null
    team_members?: Array<{ user_id: string; role: string; profiles?: { full_name: string } | null }>
  }

  const teams = teamsRes.data as TeamRow[] | null
  const departments = deptsRes.data as Array<{ id: string; name: string }> | null

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Oversee all teams in the organization. {teams?.length ?? 0} teams total.
          </p>
        </div>
        <TeamsClient
          departments={departments ?? []}
          orgUsers={orgUsers}
          orgId={profile?.org_id ?? ''}
          currentUserId={user.id}
          mode="create"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Teams', value: teams?.length ?? 0 },
          { label: 'Private Teams', value: teams?.filter(t => t.is_private).length ?? 0 },
          { label: 'Public Teams', value: teams?.filter(t => !t.is_private).length ?? 0 },
          { label: 'Total Members', value: [...new Set(teams?.flatMap(t => t.team_members?.map(m => m.user_id) ?? []))].length },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Teams table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Teams</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">Team</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Department</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Members</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Visibility</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teams?.map(team => (
                <tr key={team.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                        style={{ backgroundColor: team.color }}
                      >
                        {team.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{team.name}</p>
                        {team.description && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{team.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-500">
                    {team.departments?.name ?? '—'}
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium">{team.team_members?.length ?? 0}</p>
                      <p className="text-xs text-gray-400">
                        {team.team_members?.filter(m => m.role === 'team_leader').map(m => m.profiles?.full_name).filter(Boolean)[0] ?? 'No leader'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {team.is_private ? (
                      <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Private</Badge>
                    ) : (
                      <Badge variant="success" className="gap-1"><Globe className="h-3 w-3" /> Public</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <TeamsClient
                      departments={departments ?? []}
                      orgUsers={orgUsers}
                      orgId={profile?.org_id ?? ''}
                      currentUserId={user.id}
                      teamId={team.id}
                      team={team}
                      isMember
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
