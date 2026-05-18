import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MessagesLayout } from '@/components/messages/messages-layout'

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id, full_name, avatar_url').eq('id', user.id).single()
  const profile = profileRes.data as { org_id: string; full_name: string; avatar_url: string | null } | null
  const orgId = profile?.org_id ?? ''

  const [channelsRes, usersRes, deptsRes] = await Promise.all([
    supabase.from('channels').select(`
      id, name, description, is_private, is_direct, team_id, dept_id, created_at,
      channel_members!inner(user_id, last_read_at)
    `).eq('org_id', orgId).order('name'),
    supabase.from('profiles').select('id, full_name, email, avatar_url, dept_id, role').eq('org_id', orgId).eq('is_active', true).neq('id', user.id).order('full_name'),
    supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
  ])

  type RawChannel = {
    id: string; name: string; description: string | null; is_private: boolean; is_direct: boolean
    team_id: string | null; dept_id: string | null; created_at: string
    channel_members?: Array<{ user_id: string; last_read_at: string }>
  }
  type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null; dept_id: string | null; role: string }

  const rawChannels = channelsRes.data as unknown as RawChannel[]
  const orgUsers = usersRes.data as OrgUser[] | null
  const departments = deptsRes.data as Array<{ id: string; name: string }> | null

  // Filter to channels where current user is a member
  const channels = (rawChannels ?? []).filter(c =>
    c.channel_members?.some(m => m.user_id === user.id)
  )

  // Compute initial unread counts: messages after last_read_at, not sent by current user
  const unreadResults = await Promise.all(
    channels.map(async ch => {
      const lastReadAt = ch.channel_members?.find(m => m.user_id === user.id)?.last_read_at ?? null
      const query = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', ch.id)
        .neq('user_id', user.id)
      if (lastReadAt) query.gt('created_at', lastReadAt)
      const { count } = await query
      return [ch.id, count ?? 0] as [string, number]
    })
  )
  const initialUnreadCounts = Object.fromEntries(unreadResults)

  return (
    <MessagesLayout
      channels={channels}
      orgUsers={orgUsers ?? []}
      departments={departments ?? []}
      orgId={orgId}
      currentUserId={user.id}
      currentUserName={profile?.full_name ?? ''}
      currentUserAvatar={profile?.avatar_url ?? null}
      initialUnreadCounts={initialUnreadCounts}
    />
  )
}
