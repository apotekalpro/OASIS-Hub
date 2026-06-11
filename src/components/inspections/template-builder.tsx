'use client'

import { useState, useRef } from 'react'
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
  { value: 'checklist', label: 'Checklist' },
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
    const res = await fetch(`/api/inspections/sections/${sectionId}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed to delete section'); return }
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
    const res = await fetch(`/api/inspections/questions/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed to save'); return }
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, template_questions: s.template_questions.map(q => q.id === questionId ? { ...q, ...patch } : q) }
        : s
    ))
  }

  async function deleteQuestion(sectionId: string, questionId: string) {
    const res = await fetch(`/api/inspections/questions/${questionId}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed to delete question'); return }
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
        <SectionRow
          key={section.id}
          section={section}
          si={si}
          expandedSections={expandedSections}
          expandedQuestions={expandedQuestions}
          onToggleSection={() => toggleSection(section.id)}
          onToggleQuestion={(qId) => toggleQuestion(qId)}
          onUpdateSectionTitle={(title) => updateSectionTitle(section.id, title)}
          onDeleteSection={() => deleteSection(section.id)}
          onAddQuestion={() => addQuestion(section.id)}
          onUpdateQuestion={(qId, patch) => updateQuestion(section.id, qId, patch)}
          onDeleteQuestion={(qId) => deleteQuestion(section.id, qId)}
          allSectionQuestions={sections.flatMap(s => s.template_questions)}
        />
      ))}
    </div>
  )
}

function SectionRow({
  section, expandedSections, expandedQuestions,
  onToggleSection, onToggleQuestion, onUpdateSectionTitle, onDeleteSection,
  onAddQuestion, onUpdateQuestion, onDeleteQuestion, allSectionQuestions,
}: {
  section: Section
  si: number
  expandedSections: Set<string>
  expandedQuestions: Set<string>
  onToggleSection: () => void
  onToggleQuestion: (qId: string) => void
  onUpdateSectionTitle: (title: string) => void
  onDeleteSection: () => void
  onAddQuestion: () => void
  onUpdateQuestion: (qId: string, patch: Partial<Question>) => void
  onDeleteQuestion: (qId: string) => void
  allSectionQuestions: Question[]
}) {
  const [title, setTitle] = useState(section.title)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
        <button onClick={onToggleSection} className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900">
          {expandedSections.has(section.id)
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>
        <input
          className="flex-1 bg-transparent font-semibold text-gray-900 focus:outline-none text-sm"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => { if (title !== section.title) onUpdateSectionTitle(title) }}
        />
        <span className="text-xs text-gray-400">{section.template_questions.length} questions</span>
        <button onClick={onDeleteSection} className="text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Questions */}
      {expandedSections.has(section.id) && (
        <div className="divide-y divide-gray-100">
          {section.template_questions.map(question => (
            <QuestionRow
              key={question.id}
              question={question}
              allQuestions={allSectionQuestions.filter(q => q.id !== question.id)}
              isExpanded={expandedQuestions.has(question.id)}
              onToggle={() => onToggleQuestion(question.id)}
              onUpdate={patch => onUpdateQuestion(question.id, patch)}
              onDelete={() => onDeleteQuestion(question.id)}
            />
          ))}
          <div className="p-3">
            <button
              onClick={onAddQuestion}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <Plus className="h-4 w-4" /> Add Question
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChecklistItemsEditor({ items: initialItems, onSave }: { items: string[]; onSave: (items: string[]) => void }) {
  const [items, setItems] = useState<string[]>(initialItems.length > 0 ? initialItems : [''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  function update(index: number, value: string) {
    const next = [...items]
    next[index] = value
    setItems(next)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const next = [...items]
      next.splice(index + 1, 0, '')
      setItems(next)
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 0)
    } else if (e.key === 'Backspace' && items[index] === '' && items.length > 1) {
      e.preventDefault()
      const next = items.filter((_, i) => i !== index)
      setItems(next)
      setTimeout(() => inputRefs.current[Math.max(0, index - 1)]?.focus(), 0)
      onSave(next.filter(Boolean))
    }
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index)
    const cleaned = next.length > 0 ? next : ['']
    setItems(cleaned)
    onSave(cleaned.filter(Boolean))
  }

  function addItem() {
    const next = [...items, '']
    setItems(next)
    setTimeout(() => inputRefs.current[next.length - 1]?.focus(), 0)
  }

  return (
    <div className="col-span-2 space-y-1.5">
      <label className="block text-xs font-medium text-gray-500">Checklist Items</label>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-gray-400 text-xs w-4 text-right shrink-0">{i + 1}.</span>
          <input
            ref={el => { inputRefs.current[i] = el }}
            type="text"
            value={item}
            onChange={e => update(i, e.target.value)}
            onKeyDown={e => handleKeyDown(e, i)}
            onBlur={() => onSave(items.filter(Boolean))}
            placeholder={i === 0 ? 'e.g. Check fire extinguisher is mounted' : 'Add item...'}
            className="flex-1 h-8 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {items.length > 1 && (
            <button type="button" onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-1 pl-5"
      >
        <Plus className="h-3.5 w-3.5" /> Add item
      </button>
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
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function saveField(patch: Partial<Question>) {
    setSaving(true)
    setSaved(false)
    await onUpdate(patch)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  // Local state for all text inputs — onChange updates local state instantly (no lag),
  // onBlur persists to DB. This prevents async DB re-renders from dropping keystrokes.
  const [questionText, setQuestionText] = useState(question.question_text)
  const [hintText, setHintText] = useState(question.hint_text ?? '')
  const [referenceNote, setReferenceNote] = useState(question.reference_note ?? '')
  const [dependsOnValue, setDependsOnValue] = useState(question.depends_on_value ?? '')
  const [scoreWeight, setScoreWeight] = useState(String(question.score_weight))
  const [optionsText, setOptionsText] = useState((question.options ?? []).join('\n'))
  const [numericMin, setNumericMin] = useState(question.numeric_min != null ? String(question.numeric_min) : '')
  const [numericMax, setNumericMax] = useState(question.numeric_max != null ? String(question.numeric_max) : '')
  const [numericThreshold, setNumericThreshold] = useState(question.numeric_threshold != null ? String(question.numeric_threshold) : '')

  const needsOptions = ['multiple_choice', 'multi_select', 'checklist'].includes(question.question_type)
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
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              onBlur={() => { if (questionText !== question.question_text) saveField({ question_text: questionText }) }}
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
            {saving && <span className="text-xs text-gray-400 animate-pulse">Saving…</span>}
            {saved && <span className="text-xs text-green-600">Saved</span>}
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
              onChange={e => saveField({ question_type: e.target.value })}
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
              value={scoreWeight}
              onChange={e => setScoreWeight(e.target.value)}
              onBlur={() => saveField({ score_weight: parseFloat(scoreWeight) || 1 })}
            />
          </div>

          {/* Hint text */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Hint / Helper Text</label>
            <input
              className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Shown beneath the question to guide the auditor"
              value={hintText}
              onChange={e => setHintText(e.target.value)}
              onBlur={() => { if (hintText !== (question.hint_text ?? '')) saveField({ hint_text: hintText || null }) }}
            />
          </div>

          {/* Checklist items — interactive row-per-item builder */}
          {needsOptions && question.question_type === 'checklist' && (
            <ChecklistItemsEditor
              items={(question.options ?? []).length > 0 ? question.options! : ['']}
              onSave={items => saveField({ options: items.filter(Boolean) })}
            />
          )}

          {/* Options (for MCQ / multi-select) — textarea */}
          {needsOptions && question.question_type !== 'checklist' && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Options (one per line)</label>
              <textarea
                className="flex w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                value={optionsText}
                onChange={e => setOptionsText(e.target.value)}
                onBlur={() => {
                  const opts = optionsText.split('\n').map(s => s.trim()).filter(Boolean)
                  saveField({ options: opts.length > 0 ? opts : null })
                }}
                placeholder={'Yes, all stock is rotated correctly\nPartially rotated\nNo rotation observed'}
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
                  value={numericMin}
                  onChange={e => setNumericMin(e.target.value)}
                  onBlur={() => saveField({ numeric_min: numericMin ? parseFloat(numericMin) : null })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Max Value</label>
                <input
                  type="number"
                  className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={numericMax}
                  onChange={e => setNumericMax(e.target.value)}
                  onBlur={() => saveField({ numeric_max: numericMax ? parseFloat(numericMax) : null })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Issue Threshold (flag if below)</label>
                <input
                  type="number"
                  className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={numericThreshold}
                  onChange={e => setNumericThreshold(e.target.value)}
                  onBlur={() => saveField({ numeric_threshold: numericThreshold ? parseFloat(numericThreshold) : null })}
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
              onChange={e => saveField({ flags_issue_on: e.target.value || null })}
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
                onChange={e => saveField({ issue_severity: e.target.value })}
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
                  onChange={e => saveField({ depends_on_question_id: e.target.value || null })}
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
                    value={dependsOnValue}
                    onChange={e => setDependsOnValue(e.target.value)}
                    onBlur={() => { if (dependsOnValue !== (question.depends_on_value ?? '')) saveField({ depends_on_value: dependsOnValue || null }) }}
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
              value={referenceNote}
              onChange={e => setReferenceNote(e.target.value)}
              onBlur={() => { if (referenceNote !== (question.reference_note ?? '')) saveField({ reference_note: referenceNote || null }) }}
            />
          </div>

          {/* Required toggle */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                checked={question.is_required}
                onChange={e => saveField({ is_required: e.target.checked })}
              />
              <span className="text-xs text-gray-600 font-medium">Required (cannot skip)</span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
