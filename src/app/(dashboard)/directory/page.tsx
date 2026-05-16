import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DirectoryClient } from '@/components/directory/directory-client'
import type { UserRole } from '@/types/database'

export default async function DirectoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = profileRes.data?.org_id ?? ''

  const admin = createAdminClient()
  const [usersRes, deptsRes, teamsRes] = await Promise.all([
    admin.from('profiles').select(`
      id, full_name, email, avatar_url, job_title, role, dept_id, phone, is_active, last_login_at,
      departments!dept_id(name)
    `).eq('org_id', orgId).eq('is_active', true).order('full_name'),
    admin.from('departments').select('id, name').eq('org_id', orgId).order('name'),
    admin.from('teams').select('id, name, color, team_members(user_id)').eq('org_id', orgId).order('name'),
  ])

  type DirectoryUser = {
    id: string; full_name: string; email: string; avatar_url: string | null;
    job_title: string | null; role: UserRole; dept_id: string | null; phone: string | null;
    is_active: boolean; last_login_at: string | null;
    departments?: { name: string } | null
  }

  type TeamWithMembers = {
    id: string; name: string; color: string;
    team_members?: Array<{ user_id: string }>
  }

  const users = usersRes.data as DirectoryUser[] | null
  const departments = deptsRes.data as Array<{ id: string; name: string }> | null
  const teams = teamsRes.data as TeamWithMembers[] | null

  return (
    <DirectoryClient
      users={users ?? []}
      departments={departments ?? []}
      teams={teams ?? []}
    />
  )
}
