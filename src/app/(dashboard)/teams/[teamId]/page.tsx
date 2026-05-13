import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth/permissions'
import { TeamMembersClient } from '@/components/teams/team-members-client'
import { Globe, Lock, Users } from 'lucide-react'
import type { UserRole } from '@/types/database'

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [teamRes, allUsersRes] = await Promise.all([
    supabase.from('teams').select(`
      id, name, description, color, is_private, created_at,
      departments(name),
      team_members(
        user_id, role, joined_at,
        profiles(id, full_name, email, avatar_url, job_title, role)
      )
    `).eq('id', teamId).single(),
    supabase.from('profiles').select('id, full_name, email, avatar_url, job_title, role').eq('is_active', true).order('full_name'),
  ])

  if (!teamRes.data) notFound()

  type Member = {
    user_id: string; role: string; joined_at: string;
    profiles?: { id: string; full_name: string; email: string; avatar_url: string | null; job_title: string | null; role: string } | null
  }
  const team = teamRes.data as unknown as {
    id: string; name: string; description: string | null; color: string; is_private: boolean; created_at: string;
    departments?: { name: string } | null;
    team_members?: Member[]
  }

  type UserRow = { id: string; full_name: string; email: string; avatar_url: string | null; job_title: string | null; role: string }
  const allUsers = allUsersRes.data as UserRow[] | null

  const members = team.team_members ?? []
  const memberIds = new Set(members.map(m => m.user_id))
  const myMembership = members.find(m => m.user_id === user.id)
  const isLeader = myMembership?.role === 'team_leader'
  const nonMembers = allUsers?.filter(u => !memberIds.has(u.id)) ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0"
          style={{ backgroundColor: team.color }}
        >
          {team.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
            {team.is_private
              ? <Lock className="h-4 w-4 text-gray-400" />
              : <Globe className="h-4 w-4 text-gray-400" />}
          </div>
          {team.departments?.name && (
            <p className="text-sm text-gray-500 mt-0.5">{team.departments.name}</p>
          )}
          {team.description && (
            <p className="text-gray-600 mt-1">{team.description}</p>
          )}
        </div>
        {isLeader && (
          <TeamMembersClient teamId={teamId} nonMembers={nonMembers} mode="add" />
        )}
      </div>

      {/* Members grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members ({members.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {members.map(m => {
              const p = m.profiles
              if (!p) return null
              return (
                <div key={m.user_id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                  <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{p.full_name}</p>
                    <p className="text-sm text-gray-500 truncate">{p.email}</p>
                    {p.job_title && (
                      <p className="text-xs text-gray-400">{p.job_title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[p.role as UserRole]}`}>
                      {ROLE_LABELS[p.role as UserRole]}
                    </span>
                    <Badge variant={m.role === 'team_leader' ? 'default' : 'secondary'}>
                      {m.role === 'team_leader' ? 'Leader' : 'Member'}
                    </Badge>
                    {isLeader && m.user_id !== user.id && (
                      <TeamMembersClient
                        teamId={teamId}
                        memberId={m.user_id}
                        memberName={p.full_name}
                        memberRole={m.role}
                        nonMembers={[]}
                        mode="member-actions"
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
