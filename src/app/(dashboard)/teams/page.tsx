import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { Users, Lock, Globe } from 'lucide-react'
import { TeamsClient } from '@/components/teams/teams-client'
import type { Profile } from '@/types/database'

export default async function TeamsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch profile first to get org_id — needed for explicit filter below
  const { data: profileData } = await supabase
    .from('profiles')
    .select('org_id, role, dept_id')
    .eq('id', user.id)
    .single()
  const profile = profileData as Pick<Profile, 'org_id' | 'role' | 'dept_id'> | null
  const orgId = profile?.org_id ?? ''

  const admin = await createAdminClient()
  const [teamsRes, deptsRes] = await Promise.all([
    admin.from('teams').select(`
      id, name, description, color, is_private, created_by, created_at,
      departments!dept_id(name),
      team_members(user_id, role, profiles(id, full_name, avatar_url))
    `).eq('org_id', orgId).order('name'),
    admin.from('departments').select('id, name').eq('org_id', orgId).order('name'),
  ])

  type TeamRow = {
    id: string; name: string; description: string | null; color: string;
    is_private: boolean; created_by: string | null; created_at: string;
    departments?: { name: string } | null;
    team_members?: Array<{
      user_id: string; role: string;
      profiles?: { id: string; full_name: string; avatar_url: string | null } | null
    }>
  }

  const teams = teamsRes.data as TeamRow[] | null
  const departments = deptsRes.data as Array<{ id: string; name: string }> | null

  // Separate my teams from other teams
  const myTeams = teams?.filter(t => t.team_members?.some(m => m.user_id === user.id)) ?? []
  const otherTeams = teams?.filter(t => !t.team_members?.some(m => m.user_id === user.id) && !t.is_private) ?? []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Collaborate in focused groups. {teams?.length ?? 0} teams in your organization.
          </p>
        </div>
        <TeamsClient
          departments={departments ?? []}
          orgId={profile?.org_id ?? ''}
          currentUserId={user.id}
          mode="create"
        />
      </div>

      {/* My Teams */}
      {myTeams.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            My Teams ({myTeams.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myTeams.map(team => (
              <TeamCard
                key={team.id}
                team={team}
                currentUserId={user.id}
                departments={departments ?? []}
                orgId={profile?.org_id ?? ''}
                isMember
              />
            ))}
          </div>
        </section>
      )}

      {/* Other Teams */}
      {otherTeams.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Other Teams ({otherTeams.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherTeams.map(team => (
              <TeamCard
                key={team.id}
                team={team}
                currentUserId={user.id}
                departments={departments ?? []}
                orgId={profile?.org_id ?? ''}
                isMember={false}
              />
            ))}
          </div>
        </section>
      )}

      {!myTeams.length && !otherTeams.length && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Users className="h-12 w-12 text-gray-300 mb-3" />
          <p className="font-medium">No teams yet</p>
          <p className="text-sm mt-1">Create your first team to get started.</p>
        </div>
      )}
    </div>
  )
}

type TeamRow = {
  id: string; name: string; description: string | null; color: string;
  is_private: boolean; created_by: string | null; created_at: string;
  departments?: { name: string } | null;
  team_members?: Array<{
    user_id: string; role: string;
    profiles?: { id: string; full_name: string; avatar_url: string | null } | null
  }>
}

function TeamCard({
  team, currentUserId, departments, orgId, isMember
}: {
  team: TeamRow
  currentUserId: string
  departments: Array<{ id: string; name: string }>
  orgId: string
  isMember: boolean
}) {
  const members = team.team_members ?? []
  const myRole = members.find(m => m.user_id === currentUserId)?.role
  const displayMembers = members.slice(0, 5)
  const extraCount = Math.max(0, members.length - 5)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: team.color }}
            >
              {team.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-gray-900 leading-tight">{team.name}</h3>
                {team.is_private
                  ? <Lock className="h-3 w-3 text-gray-400" />
                  : <Globe className="h-3 w-3 text-gray-400" />}
              </div>
              {team.departments?.name && (
                <p className="text-xs text-gray-400 mt-0.5">{team.departments.name}</p>
              )}
            </div>
          </div>
          <TeamsClient
            departments={departments}
            orgId={orgId}
            currentUserId={currentUserId}
            teamId={team.id}
            team={team}
            isMember={isMember}
            mode="actions"
          />
        </div>

        {team.description && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{team.description}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {displayMembers.map(m => m.profiles && (
                <UserAvatar
                  key={m.user_id}
                  name={m.profiles.full_name}
                  avatarUrl={m.profiles.avatar_url}
                  size="sm"
                  className="ring-2 ring-white"
                />
              ))}
              {extraCount > 0 && (
                <div className="h-7 w-7 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center text-xs font-medium text-gray-600">
                  +{extraCount}
                </div>
              )}
            </div>
            <span className="ml-2 text-xs text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</span>
          </div>
          {myRole && (
            <Badge variant={myRole === 'team_leader' ? 'default' : 'secondary'} className="text-xs">
              {myRole === 'team_leader' ? 'Leader' : 'Member'}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
