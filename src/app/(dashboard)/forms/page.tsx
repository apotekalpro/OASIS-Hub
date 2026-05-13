import { createClient } from '@/lib/supabase/server'
import { FormsClient } from '@/components/forms/forms-client'

export default async function FormsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single()
  const profile = profileRes.data as { org_id: string; role: string } | null
  const orgId = profile?.org_id ?? ''
  const role = profile?.role ?? 'member'

  const [templatesRes, myAssignmentsRes, deptsRes, teamsRes] = await Promise.all([
    supabase.from('form_templates')
      .select('id, title, description, is_active, passing_score, created_at, dept_id, departments(name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase.from('form_assignments')
      .select(`
        id, due_date, is_recurring,
        form_templates(id, title, description),
        form_submissions(id, status, score, submitted_at)
      `)
      .or(`assigned_to.eq.${user.id},assigned_team.in.(${
        // We'll filter in client; just fetch all for the user
        'select team_id from team_members where user_id = ' + user.id
      })`)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
    supabase.from('teams').select('id, name').eq('org_id', orgId).order('name'),
  ])

  // Simpler assignment query - just assigned_to
  const assignmentsRes = await supabase.from('form_assignments')
    .select(`
      id, due_date, is_recurring, form_id,
      form_templates(id, title, description),
      form_submissions(id, status, score, submitted_at)
    `)
    .eq('assigned_to', user.id)
    .order('created_at', { ascending: false })

  type RawTemplate = {
    id: string; title: string; description: string | null; is_active: boolean
    passing_score: number | null; created_at: string; dept_id: string | null
    departments?: { name: string } | null
  }
  type RawAssignment = {
    id: string; due_date: string | null; is_recurring: boolean; form_id: string
    form_templates?: { id: string; title: string; description: string | null } | null
    form_submissions?: Array<{ id: string; status: string; score: number | null; submitted_at: string | null }>
  }

  const templates = (templatesRes.data as unknown as RawTemplate[]) ?? []
  const assignments = (assignmentsRes.data as unknown as RawAssignment[]) ?? []
  const depts = deptsRes.data as Array<{ id: string; name: string }> | null
  const teams = teamsRes.data as Array<{ id: string; name: string }> | null

  return (
    <FormsClient
      templates={templates}
      assignments={assignments}
      orgId={orgId}
      currentUserId={user.id}
      userRole={role}
      departments={depts ?? []}
      teams={teams ?? []}
    />
  )
}
