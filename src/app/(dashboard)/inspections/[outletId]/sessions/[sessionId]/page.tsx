import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { InspectionExecutor } from '@/components/inspections/inspection-executor'

export default async function SessionPage({
  params,
}: {
  params: { outletId: string; sessionId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [sessionRes, outletRes] = await Promise.all([
    supabase
      .from('inspection_sessions')
      .select('*, inspection_templates(title, category, passing_score)')
      .eq('id', params.sessionId)
      .single(),
    supabase
      .from('outlets')
      .select('id, name, code, city')
      .eq('id', params.outletId)
      .single(),
  ])

  if (!sessionRes.data || !outletRes.data) return notFound()

  const session = sessionRes.data as {
    id: string; status: string; score: number | null; pass_fail: boolean | null
    conducted_by: string; template_id: string
    inspection_templates?: { title: string; category: string | null; passing_score: number | null } | null
  }

  if (session.status === 'submitted' || session.status === 'approved') {
    redirect(`/inspections/${params.outletId}`)
  }

  // Load template questions with sections
  const { data: sectionsData } = await supabase
    .from('template_sections')
    .select('*, template_questions(*)')
    .eq('template_id', session.template_id)
    .order('position')
    .order('position', { referencedTable: 'template_questions' })

  // Load existing responses for this session
  const { data: existingResponses } = await supabase
    .from('session_responses')
    .select('*')
    .eq('session_id', params.sessionId)

  type Question = {
    id: string; question_text: string; hint_text: string | null; question_type: string
    options: string[] | null; is_required: boolean; score_weight: number
    numeric_min: number | null; numeric_max: number | null; numeric_threshold: number | null
    flags_issue_on: string | null; issue_severity: string | null
    depends_on_question_id: string | null; depends_on_value: string | null
    reference_note: string | null; position: number
  }

  type Section = { id: string; title: string; description: string | null; position: number; template_questions: Question[] }

  const sections = (sectionsData ?? []) as Section[]
  const responses = existingResponses ?? []

  const outlet = outletRes.data as { id: string; name: string; code: string | null; city: string | null }

  return (
    <InspectionExecutor
      session={session}
      outlet={outlet}
      sections={sections}
      initialResponses={responses}
      currentUserId={user.id}
    />
  )
}
