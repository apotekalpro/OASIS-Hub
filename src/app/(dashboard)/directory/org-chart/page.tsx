import { createClient } from '@/lib/supabase/server'
import { OrgChartClient } from '@/components/directory/org-chart-client'
import type { UserRole } from '@/types/database'

export default async function OrgChartPage() {
  const supabase = await createClient()

  const [deptsRes, usersRes, orgRes] = await Promise.all([
    supabase.from('departments').select('id, name, parent_id, color, description').order('name'),
    supabase.from('profiles').select('id, full_name, avatar_url, role, dept_id, job_title').eq('is_active', true),
    supabase.from('organizations').select('name').limit(1),
  ])

  type DeptRow = { id: string; name: string; parent_id: string | null; color: string; description: string | null }
  type UserRow = { id: string; full_name: string; avatar_url: string | null; role: UserRole; dept_id: string | null; job_title: string | null }

  return (
    <OrgChartClient
      departments={(deptsRes.data as DeptRow[]) ?? []}
      users={(usersRes.data as UserRow[]) ?? []}
      orgName={(orgRes.data as Array<{ name: string }>)?.[0]?.name ?? 'Organization'}
    />
  )
}
