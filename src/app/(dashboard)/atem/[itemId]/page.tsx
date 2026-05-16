import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AtemDetailClient } from '@/components/atem/atem-detail-client'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AtemDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await admin.from('profiles').select('org_id, full_name, role, avatar_url').eq('id', user.id).single()
  const { org_id: orgId, full_name, role, avatar_url } = (profileRes.data ?? {}) as {
    org_id: string; full_name: string; role: string; avatar_url: string | null
  }

  const [itemRes, commentsRes, assigneesRes, watchersRes, usersRes, deptsRes, teamsRes] = await Promise.all([
    admin.from('atem_items').select('*, departments(name), teams(name)').eq('id', itemId).single(),
    admin.from('atem_comments')
      .select('*, profiles!atem_comments_user_id_fkey(id, full_name, avatar_url), atem_comment_reactions(id, emoji, user_id)')
      .eq('atem_id', itemId).order('created_at', { ascending: true }),
    admin.from('atem_assignees').select('user_id').eq('atem_id', itemId),
    admin.from('atem_watchers').select('user_id').eq('atem_id', itemId),
    admin.from('profiles').select('id, full_name, email, avatar_url').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    admin.from('departments').select('id, name').eq('org_id', orgId).order('name'),
    admin.from('teams').select('id, name').eq('org_id', orgId).order('name'),
  ])

  if (!itemRes.data) return notFound()

  const assigneeIds = (assigneesRes.data ?? []).map(a => a.user_id)
  const watcherIds = (watchersRes.data ?? []).map(w => w.user_id)
  const allUsers = usersRes.data ?? []
  const assignees = allUsers.filter(u => assigneeIds.includes(u.id))
  const watchers = allUsers.filter(u => watcherIds.includes(u.id))

  return (
    <AtemDetailClient
      item={itemRes.data}
      comments={commentsRes.data ?? []}
      assignees={assignees}
      watchers={watchers}
      orgId={orgId}
      currentUserId={user.id}
      currentUserName={full_name}
      currentUserAvatar={avatar_url}
      currentUserRole={role}
      users={allUsers}
      departments={deptsRes.data ?? []}
      teams={teamsRes.data ?? []}
    />
  )
}
