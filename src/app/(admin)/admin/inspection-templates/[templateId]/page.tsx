import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { TemplateBuilder } from '@/components/inspections/template-builder'

export default async function TemplateBuilderPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [templateRes, sectionsRes] = await Promise.all([
    supabase
      .from('inspection_templates')
      .select('*')
      .eq('id', templateId)
      .single(),
    supabase
      .from('template_sections')
      .select('*, template_questions(*)')
      .eq('template_id', templateId)
      .order('position')
      .order('position', { referencedTable: 'template_questions' }),
  ])

  if (!templateRes.data) return notFound()

  type Question = {
    id: string; question_text: string; hint_text: string | null; question_type: string
    options: string[] | null; is_required: boolean; score_weight: number
    numeric_min: number | null; numeric_max: number | null; numeric_threshold: number | null
    flags_issue_on: string | null; issue_severity: string | null
    depends_on_question_id: string | null; depends_on_value: string | null
    reference_image_url: string | null; reference_note: string | null; position: number
  }

  type Section = {
    id: string; title: string; description: string | null; position: number
    template_questions: Question[]
  }

  const template = templateRes.data
  const sections = (sectionsRes.data ?? []) as Section[]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/admin/inspection-templates"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Templates
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{template.title}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {template.category && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{template.category}</span>}
                  {template.is_mystery_shopper && <Badge variant="default" className="text-xs">Mystery Shopper</Badge>}
                  {!template.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  {template.passing_score && <span className="text-xs text-gray-500">Pass: {template.passing_score}%</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Builder */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <TemplateBuilder templateId={params.templateId} initialSections={sections} />
      </div>
    </div>
  )
}
