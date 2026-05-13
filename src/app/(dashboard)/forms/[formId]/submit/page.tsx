import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { FormSubmitClient } from '@/components/forms/form-submit-client'

export default async function FormSubmitPage({ params, searchParams }: {
  params: Promise<{ formId: string }>
  searchParams: Promise<{ assignment?: string; submission?: string }>
}) {
  const { formId } = await params
  const { assignment: assignmentId, submission: submissionId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [formRes, existingSubRes] = await Promise.all([
    supabase.from('form_templates').select('id, title, description, fields, passing_score').eq('id', formId).single(),
    submissionId
      ? supabase.from('form_submissions').select('id, answers, status').eq('id', submissionId).single()
      : Promise.resolve({ data: null }),
  ])

  if (!formRes.data) return notFound()

  type FormData = { id: string; title: string; description: string | null; fields: object[]; passing_score: number | null }
  type SubData = { id: string; answers: Record<string, unknown>; status: string }

  const form = formRes.data as FormData
  const existingSub = existingSubRes.data as SubData | null

  return (
    <FormSubmitClient
      form={form}
      existingSubmission={existingSub}
      assignmentId={assignmentId ?? null}
      currentUserId={user.id}
    />
  )
}
