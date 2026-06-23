import { createClient, createAdminClient } from '@/lib/supabase/server'
import { PillarDetailClient } from '@/components/pillar/pillar-detail-client'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import type { UserRole } from '@/types/database'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PillarDetailPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await admin.from('profiles').select('full_name, role, avatar_url, org_id').eq('id', user.id).single()
  const { full_name, role, avatar_url, org_id } = (profileRes.data ?? {}) as { full_name: string; role: UserRole; avatar_url: string | null; org_id: string }
  const featurePermissions = await getCachedFeaturePermissions(org_id ?? '')
  const canDelete = canManagePillarTemplates(role, featurePermissions)

  const [assignmentRes, krsRes, subtasksRes, commentsRes] = await Promise.all([
    admin.from('pillar_assignments')
      .select('*, outlets(name, code), profiles!pillar_assignments_assigned_to_fkey(id, full_name, avatar_url), departments(name)')
      .eq('id', assignmentId).single(),
    admin.from('pillar_assignment_krs').select('*').eq('assignment_id', assignmentId).order('created_at'),
    admin.from('pillar_subtasks').select('*').eq('assignment_id', assignmentId).order('position'),
    admin.from('pillar_comments').select('*, profiles!pillar_comments_user_id_fkey(id, full_name, avatar_url)').eq('assignment_id', assignmentId).order('created_at'),
  ])

  if (!assignmentRes.data) return notFound()

  return (
    <PillarDetailClient
      assignment={assignmentRes.data}
      initialKeyResults={krsRes.data ?? []}
      initialSubtasks={subtasksRes.data ?? []}
      initialComments={commentsRes.data ?? []}
      currentUserId={user.id}
      currentUserName={full_name}
      currentUserAvatar={avatar_url}
      currentUserRole={role}
      canDelete={canDelete}
    />
  )
}
