import { createClient } from '@/lib/supabase/server'
import { CalendarClient } from '@/components/calendar/calendar-client'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id, full_name').eq('id', user.id).single()
  const orgId = (profileRes.data as { org_id: string } | null)?.org_id ?? ''

  const [eventsRes, usersRes, teamsRes, deptsRes] = await Promise.all([
    supabase.from('events').select(`
      id, title, description, location, start_at, end_at, is_all_day,
      team_id, dept_id, created_by,
      teams(name, color),
      event_attendees(user_id, rsvp)
    `).eq('org_id', orgId).order('start_at'),
    supabase.from('profiles').select('id, full_name, email, avatar_url').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    supabase.from('teams').select('id, name, color').eq('org_id', orgId).order('name'),
    supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
  ])

  type RawEvent = {
    id: string; title: string; description: string | null; location: string | null
    start_at: string; end_at: string; is_all_day: boolean
    team_id: string | null; dept_id: string | null; created_by: string
    teams?: { name: string; color: string } | null
    event_attendees?: Array<{ user_id: string; rsvp: string }>
  }
  type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }

  const events = (eventsRes.data as unknown as RawEvent[]) ?? []
  const users = (usersRes.data as OrgUser[]) ?? []
  const teams = (teamsRes.data as Array<{ id: string; name: string; color: string }>) ?? []
  const depts = (deptsRes.data as Array<{ id: string; name: string }>) ?? []

  return (
    <CalendarClient
      initialEvents={events}
      orgId={orgId}
      currentUserId={user.id}
      users={users}
      teams={teams}
      departments={depts}
    />
  )
}
