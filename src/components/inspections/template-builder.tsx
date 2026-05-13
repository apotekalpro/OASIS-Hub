'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const QUESTION_TYPES = [
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'multi_select', label: 'Multi-Select' },
  { value: 'text', label: 'Text (Free-form)' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'photo', label: 'Photo Evidence' },
  { value: 'file', label: 'File Upload' },
  { value: 'rating', label: 'Rating (1–5)' },
  { value: 'datetime', label: 'Date / Time' },
  { value: 'barcode', label: 'Barcode Scan' },
]

const FLAG_OPTIONS = [
  { value: '', label: '— Never flag —' },
  { value: 'no', label: 'Flag when answer is No/Fail' },
  { value: 'below_threshold', label: 'Flag when below threshold' },
  { value: 'always', label: 'Always flag (mandatory issue)' },
]

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

type Question = {
  id: string; question_text: string; hint_text: string | null; question_type: string
  options: string[] | null; is_required: boolean; score_weight: number
  numeric_min: number | null; numeric_max: number | null; numeric_threshold: number | null
  flags_issue_on: string | null; issue_severity: string | null
  depends_on_question_id: string | null; depends_on_value: string | null
  reference_note: string | null; position: number
}

type Section = {
  id: string; title: string; description: string | null; position: number
  template_questions: Question[]
}

interface Props {
  templateId: string
  initialSections: Section[]
}

export function TemplateBuilder({ templateId, initialSections }: Props) {
  const router = useRouter()
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(initialSections.map(s => s.id)))
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleQuestion(id: string) {
    setExpandedQuestions(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function addSection() {
    setSaving(true)
    const supabase = createClient()
    const position = sections.length
    const { data, error } = await supabase
      .from('template_sections')
      .insert({ template_id: templateId, title: 'New Section', position })
      .select()
      .single()
    setSaving(false)
    if (error) { toast.error(error.message); return }
    const newSection: Section = { ...(data as Section), template_questions: [] }
    setSections(prev => [...prev, newSection])
    setExpandedSections(prev => new Set([...prev, newSection.id]))
    toast.success('Section added')
  }

  async function updateSectionTitle(sectionId: string, title: string) {
    const supabase = createClient()
    const { error } = await supabase.from('template_sections').update({ title }).eq('id', sectionId)
    if (error) { toast.error(error.message); return }
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, title } : s))
  }

  async function deleteSection(sectionId: string) {
    const supabase = createClient()
    const { error } = await supabase.from('template_sections').delete().eq('id', sectionId)
    if (error) { toast.error(error.message); return }
    setSections(prev => prev.filter(s => s.id !== sectionId))
    toast.success('Section deleted')
  }

  async function addQuestion(sectionId: string) {
    const supabase = createClient()
    const section = sections.find(s => s.id === sectionId)
    const position = section?.template_questions.length ?? 0
    const { data, error } = await supabase
      .from('template_questions')
      .insert({
        section_id: sectionId,
        template_id: templateId,
        question_text: 'New Question',
        question_type: 'yes_no',
        is_required: true,
        score_weight: 1,
        position,
      })
      .select()
      .single()
    if (error) { toast.error(error.message); return }
    const newQ = data as Question
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, template_questions: [...s.template_questions, newQ] } : s
    ))
    setExpandedQuestions(prev => new Set([...prev, newQ.id]))
  }

  async function updateQuestion(sectionId: string, questionId: string, patch: Partial<Question>) {
    const supabase = createClient()
    const { error } = await supabase.from('template_questions').update(patch).eq('id', questionId)
    if (error) { toast.error(error.message); return }
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, template_questions: s.template_questions.map(q => q.id === questionId ? { ...q, ...patch } : q) }
        : s
    ))
  }

  async function deleteQuestion(sectionId: string, questionId: string) {
    const supabase = createClient()
    const { error } = await supabase.from('template_questions').delete().eq('id', questionId)
    if (error) { toast.error(error.message); return }
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, template_questions: s.template_questions.filter(q => q.id !== questionId) } : s
    ))
  }

  const totalQuestions = sections.reduce((acc, s) => acc + s.template_questions.length, 0)

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {sections.length} section{sections.length !== 1 ? 's' : ''} · {totalQuestions} question{totalQuestions !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={addSection} loading={saving}>
          <Plus className="h-4 w-4" /> Add Section
        </Button>
      </div>

      {sections.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-sm">No sections yet. Click "Add Section" to start building your checklist.</p>
        </div>
      )}

      {/* Sections */}
      {sections.map((section, si) => (
        <div key={section.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Section header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
            <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
            <button onClick={() => toggleSection(section.id)} className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900">
              {expandedSections.has(section.id)
                ? <ChevronDown className="h-4 w-4" />
                : <ChevronRight className="h-4 w-4" />
              }
            </button>
            <input
              className="flex-1 bg-transparent font-semibold text-gray-900 focus:outline-none text-sm"
              value={section.title}
              onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))}
              onBlur={e => updateSectionTitle(section.id, e.target.value)}
            />
            <span className="text-xs text-gray-400">{section.template_questions.length} questions</span>
            <button
              onClick={() => deleteSection(section.id)}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Questions */}
          {expandedSections.has(section.id) && (
            <div className="divide-y divide-gray-100">
              {section.template_questions.map((question, qi) => (
                <QuestionRow
                  key={question.id}
                  question={question}
                  allQuestions={sections.flatMap(s => s.template_questions).filter(q => q.id !== question.id)}
                  isExpanded={expandedQuestions.has(question.id)}
                  onToggle={() => toggleQuestion(question.id)}
                  onUpdate={patch => updateQuestion(section.id, question.id, patch)}
                  onDelete={() => deleteQuestion(section.id, question.id)}
                />
              ))}
              <div className="p-3">
                <button
                  onClick={() => addQuestion(section.id)}
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Plus className="h-4 w-4" /> Add Question
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function QuestionRow({
  question, allQuestions, isExpanded, onToggle, onUpdate, onDelete,
}: {
  question: Question
  allQuestions: Question[]
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<Question>) => void
  onDelete: () => void
}) {
  const [optionsText, setOptionsText] = useState((question.options ?? []).join('\n'))

  function saveOptions() {
    const opts = optionsText.split('\n').map(s => s.trim()).filter(Boolean)
    onUpdate({ options: opts.length > 0 ? opts : null })
  }

  const needsOptions = ['multiple_choice', 'multi_select'].includes(question.question_type)
  const needsNumeric = question.question_type === 'numeric'

  return (
    <div className={cn('px-4', isExpanded ? 'py-4' : 'py-3')}>
      {/* Question summary row */}
      <div className="flex items-start gap-3">
        <GripVertical className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          {isExpanded ? (
            <input
              className="w-full text-sm font-medium text-gray-900 focus:outline-none border-b border-transparent focus:border-indigo-300 pb-0.5"
              value={question.question_text}
              onChange={e => onUpdate({ question_text: e.target.value })}
              placeholder="Question text..."
            />
          ) : (
            <p className="text-sm font-medium text-gray-900 truncate">{question.question_text}</p>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400 capitalize">{question.question_type.replace('_', ' ')}</span>
            {question.is_required && <span className="text-xs text-red-500">Required</span>}
            {question.flags_issue_on && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3" /> Flags issue
              </span>
            )}
          </div>
        </div>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded configuration */}
      {isExpanded && (
        <div className="mt-4 ml-10 grid grid-cols-2 gap-4 text-sm">
          {/* Question type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Question Type</label>
            <select
              className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={question.question_type}
              onChange={e => onUpdate({ question_type: e.target.value })}
            >
              {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Score weight */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Score Weight</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={question.score_weight}
              onChange={e => onUpdate({ score_weight: parseFloat(e.target.value) || 1 })}
            />
          </div>

          {/* Hint text */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Hint / Helper Text</label>
            <input
              className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Shown beneath the question to guide the auditor"
              value={question.hint_text ?? ''}
              onChange={e => onUpdate({ hint_text: e.target.value || null })}
            />
          </div>

          {/* Options (for MCQ / multi-select) */}
          {needsOptions && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Options (one per line)</label>
              <textarea
                className="flex w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                value={optionsText}
                onChange={e => setOptionsText(e.target.value)}
                onBlur={saveOptions}
                placeholder="Yes, all stock is rotated correctly&#10;Partially rotated&#10;No rotation observed"
              />
            </div>
          )}

          {/* Numeric config */}
          {needsNumeric && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Min Value</label>
                <input
                  type="number"
                  className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={question.numeric_min ?? ''}
                  onChange={e => onUpdate({ numeric_min: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Max Value</label>
                <input
                  type="number"
                  className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={question.numeric_max ?? ''}
                  onChange={e => onUpdate({ numeric_max: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Issue Threshold (flag if below)</label>
                <input
                  type="number"
                  className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={question.numeric_threshold ?? ''}
                  onChange={e => onUpdate({ numeric_threshold: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </>
          )}

          {/* Issue flagging */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Auto-raise Issue</label>
            <select
              className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={question.flags_issue_on ?? ''}
              onChange={e => onUpdate({ flags_issue_on: e.target.value || null })}
            >
              {FLAG_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          {question.flags_issue_on && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Issue Severity</label>
              <select
                className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={question.issue_severity ?? 'medium'}
                onChange={e => onUpdate({ issue_severity: e.target.value })}
              >
                {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}

          {/* Conditional display */}
          {allQuestions.length > 0 && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Show only when question…</label>
                <select
                  className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={question.depends_on_question_id ?? ''}
                  onChange={e => onUpdate({ depends_on_question_id: e.target.value || null })}
                >
                  <option value="">— Always show —</option>
                  {allQuestions.map(q => (
                    <option key={q.id} value={q.id}>{q.question_text.slice(0, 50)}</option>
                  ))}
                </select>
              </div>
              {question.depends_on_question_id && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">…equals value</label>
                  <input
                    className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder='e.g. "no" or "Yes"'
                    value={question.depends_on_value ?? ''}
                    onChange={e => onUpdate({ depends_on_value: e.target.value || null })}
                  />
                </div>
              )}
            </>
          )}

          {/* Reference note */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Reference Note (shown to auditor)</label>
            <input
              className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Check the SOP binder at the pharmacy counter"
              value={question.reference_note ?? ''}
              onChange={e => onUpdate({ reference_note: e.target.value || null })}
            />
          </div>

          {/* Required toggle */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                checked={question.is_required}
                onChange={e => onUpdate({ is_required: e.target.checked })}
              />
              <span className="text-xs text-gray-600 font-medium">Required (cannot skip)</span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
