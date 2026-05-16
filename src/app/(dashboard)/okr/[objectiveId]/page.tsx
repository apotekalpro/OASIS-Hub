import { createClient, createAdminClient } from '@/lib/supabase/server'
import { OkrDetailClient } from '@/components/okr/okr-detail-client'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function OkrDetailPage({ params }: { params: { objectiveId: string } }) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await admin
    .from('profiles')
    .select('org_id, full_name, role, avatar_url')
    .eq('id', user.id)
    .single()
  const { org_id: orgId, full_name, role, avatar_url } = (profileRes.data ?? {}) as {
    org_id: string; full_name: string; role: string; avatar_url: string | null
  }

  const [objectiveRes, keyResultsRes, commentsRes, assigneesRes, watchersRes, usersRes, deptsRes, teamsRes] = await Promise.all([
    admin
      .from('okr_objectives')
      .select('*, departments(name), teams(name)')
      .eq('id', params.objectiveId)
      .single(),
    admin
      .from('okr_key_results')
      .select('*')
      .eq('objective_id', params.objectiveId)
      .order('created_at', { ascending: true }),
    admin
      .from('okr_comments')
      .select('*, profiles!okr_comments_user_id_fkey(id, full_name, avatar_url), okr_comment_reactions(id, emoji, user_id)')
      .eq('objective_id', params.objectiveId)
      .order('created_at', { ascending: true }),
    admin.from('okr_assignees').select('user_id, role').eq('objective_id', params.objectiveId),
    admin.from('okr_watchers').select('user_id').eq('objective_id', params.objectiveId),
    admin.from('profiles').select('id, full_name, email, avatar_url').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    admin.from('departments').select('id, name').eq('org_id', orgId).order('name'),
    admin.from('teams').select('id, name').eq('org_id', orgId).order('name'),
  ])

  if (!objectiveRes.data) return notFound()

  const allUsers = usersRes.data ?? []
  const assigneeIds = (assigneesRes.data ?? []).map((a: { user_id: string; role: string }) => a.user_id)
  const watcherIds = (watchersRes.data ?? []).map((w: { user_id: string }) => w.user_id)
  const assignees = allUsers.filter((u: { id: string }) => assigneeIds.includes(u.id))
  const watchers = allUsers.filter((u: { id: string }) => watcherIds.includes(u.id))

  // Normalize comments to expected shape
  type RawComment = {
    id: string; content: string; created_at: string; parent_comment_id: string | null
    attachments: unknown[]; objective_id: string; user_id: string
    profiles: { id: string; full_name: string; avatar_url: string | null } | null
    okr_comment_reactions: Array<{ id: string; emoji: string; user_id: string }>
  }
  const rawComments = (commentsRes.data ?? []) as unknown as RawComment[]
  const comments = rawComments.map(c => ({
    id: c.id,
    content: c.content,
    created_at: c.created_at,
    parent_comment_id: c.parent_comment_id,
    attachments: (c.attachments ?? []) as Array<{ name: string; url: string; type: 'image' | 'file' }>,
    user: c.profiles ?? { id: c.user_id, full_name: 'Unknown', avatar_url: null },
    reactions: [] as Array<{ emoji: string; count: number; reacted: boolean }>,
    _rawReactions: c.okr_comment_reactions,
  }))

  return (
    <OkrDetailClient
      objective={objectiveRes.data}
      keyResults={keyResultsRes.data ?? []}
      comments={comments}
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
