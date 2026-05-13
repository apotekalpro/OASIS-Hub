import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { FormSubmissionsClient } from '@/components/forms/form-submissions-client'

export default async function FormDetailPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profileRes.data as { role: string } | null)?.role ?? 'member'

  const [formRes, submissionsRes] = await Promise.all([
    supabase.from('form_templates').select('id, title, description, fields, passing_score, is_active').eq('id', formId).single(),
    supabase.from('form_submissions').select(`
      id, status, score, submitted_at, created_at, reviewer_notes, reviewed_at,
      profiles!submitted_by(id, full_name, avatar_url)
    `).eq('form_id', formId).order('created_at', { ascending: false }),
  ])

  if (!formRes.data) return notFound()

  type Sub = {
    id: string; status: string; score: number | null; submitted_at: string | null
    created_at: string; reviewer_notes: string | null; reviewed_at: string | null
    profiles?: { id: string; full_name: string; avatar_url: string | null } | null
  }

  const form = formRes.data as { id: string; title: string; description: string | null; fields: object[]; passing_score: number | null; is_active: boolean }
  const submissions = (submissionsRes.data as unknown as Sub[]) ?? []

  return (
    <FormSubmissionsClient
      form={form}
      submissions={submissions.map(s => ({
        id: s.id,
        status: s.status,
        score: s.score,
        submitted_at: s.submitted_at,
        created_at: s.created_at,
        reviewer_notes: s.reviewer_notes,
        reviewed_at: s.reviewed_at,
        submitter: s.profiles ?? null,
      }))}
      currentUserId={user.id}
      userRole={role}
    />
  )
}
