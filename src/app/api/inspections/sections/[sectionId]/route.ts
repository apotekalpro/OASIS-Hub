import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const { sectionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get all question IDs in this section
  const { data: questions } = await admin
    .from('template_questions')
    .select('id')
    .eq('section_id', sectionId)

  if (questions && questions.length > 0) {
    const qIds = questions.map(q => q.id)
    // Delete session_responses referencing these questions before deleting the questions
    await admin.from('session_responses').delete().in('question_id', qIds)
  }

  // Delete the section (cascades to template_questions)
  const { error } = await admin.from('template_sections').delete().eq('id', sectionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
