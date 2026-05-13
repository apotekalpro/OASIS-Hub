import { createClient } from '@/lib/supabase/server'
import { DirectoryClient } from '@/components/directory/directory-client'
import type { UserRole } from '@/types/database'

export default async function DirectoryPage() {
  const supabase = await createClient()

  const [usersRes, deptsRes, teamsRes] = await Promise.all([
    supabase.from('profiles').select(`
      id, full_name, email, avatar_url, job_title, role, dept_id, phone, is_active, last_login_at,
      departments(name)
    `).eq('is_active', true).order('full_name'),
    supabase.from('departments').select('id, name').order('name'),
    supabase.from('teams').select('id, name, color, team_members(user_id)').order('name'),
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
