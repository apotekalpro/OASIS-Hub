'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle2, Clock, Building2, AlertTriangle,
  Camera, FileUp, ChevronDown, ChevronRight, Info,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Question = {
  id: string; question_text: string; hint_text: string | null; question_type: string
  options: string[] | null; is_required: boolean; score_weight: number
  numeric_min: number | null; numeric_max: number | null; numeric_threshold: number | null
  flags_issue_on: string | null; issue_severity: string | null
  depends_on_question_id: string | null; depends_on_value: string | null
  reference_note: string | null; position: number
}

type Section = { id: string; title: string; description: string | null; position: number; template_questions: Question[] }

type ResponsePayload = {
  answer_boolean?: boolean | null
  answer_text?: string | null
  answer_numeric?: number | null
  answer_options?: string[] | null
  note?: string | null
  flagged?: boolean
}

type ExistingResponse = {
  id: string; question_id: string; session_id: string
  answer_boolean: boolean | null; answer_text: string | null
  answer_numeric: number | null; answer_options: string[] | null
  photo_urls: string[]; file_urls: string[]; note: string | null; flagged: boolean
}

interface Props {
  session: { id: string; status: string; template_id: string; conducted_by: string; inspection_templates?: { title: string; category: string | null; passing_score: number | null } | null }
  outlet: { id: string; name: string; code: string | null; city: string | null }
  sections: Section[]
  initialResponses: ExistingResponse[]
  currentUserId: string
}

export function InspectionExecutor({ session, outlet, sections, initialResponses, currentUserId }: Props) {
  const router = useRouter()
  const [responses, setResponses] = useState<Map<string, ResponsePayload>>(
    () => new Map(initialResponses.map(r => [r.question_id, {
      answer_boolean: r.answer_boolean,
      answer_text: r.answer_text,
      answer_numeric: r.answer_numeric,
      answer_options: r.answer_options,
      note: r.note,
      flagged: r.flagged,
    }]))
  )
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(sections.map(s => s.id)))
  const [submitting, setSubmitting] = useState(false)

  const allQuestions = sections.flatMap(s => s.template_questions)

  function isVisible(question: Question): boolean {
    if (!question.depends_on_question_id) return true
    const parentResponse = responses.get(question.depends_on_question_id)
    if (!parentResponse) return false
    const depVal = question.depends_on_value?.toLowerCase()
    if (parentResponse.answer_boolean === true && (depVal === 'yes' || depVal === 'true')) return true
    if (parentResponse.answer_boolean === false && (depVal === 'no' || depVal === 'false')) return true
    if (parentResponse.answer_text?.toLowerCase() === depVal) return true
    return false
  }

  function computeFlag(question: Question, payload: ResponsePayload): boolean {
    const rule = question.flags_issue_on
    if (!rule) return false
    if (rule === 'always') return true
    if (rule === 'no' && payload.answer_boolean === false) return true
    if (rule === 'below_threshold' && question.numeric_threshold !== null && payload.answer_numeric !== null) {
      return (payload.answer_numeric ?? 0) < question.numeric_threshold
    }
    return false
  }

  async function saveResponse(questionId: string, patch: ResponsePayload) {
    const supabase = createClient()
    const question = allQuestions.find(q => q.id === questionId)
    if (!question) return

    const flagged = computeFlag(question, { ...responses.get(questionId), ...patch })
    const full = { ...patch, flagged }

    setResponses(prev => new Map(prev).set(questionId, { ...prev.get(questionId), ...full }))

    const upsertPayload = {
      session_id: session.id,
      question_id: questionId,
      answer_boolean: full.answer_boolean ?? null,
      answer_text: full.answer_text ?? null,
      answer_numeric: full.answer_numeric ?? null,
      answer_options: full.answer_options ?? null,
      note: full.note ?? null,
      flagged,
    }

    const { error } = await supabase
      .from('session_responses')
      .upsert(upsertPayload, { onConflict: 'session_id,question_id' })

    if (error) toast.error(error.message)
  }

  const visibleRequired = allQuestions.filter(q => q.is_required && isVisible(q))
  const answeredRequired = visibleRequired.filter(q => {
    const r = responses.get(q.id)
    if (!r) return false
    return r.answer_boolean !== undefined && r.answer_boolean !== null
      || (r.answer_text !== undefined && r.answer_text !== null && r.answer_text !== '')
      || (r.answer_numeric !== undefined && r.answer_numeric !== null)
      || (r.answer_options && r.answer_options.length > 0)
  })
  const progressPct = visibleRequired.length > 0 ? Math.round((answeredRequired.length / visibleRequired.length) * 100) : 100
  const flaggedCount = [...responses.values()].filter(r => r.flagged).length

  async function handleSubmit() {
    const unanswered = visibleRequired.filter(q => {
      const r = responses.get(q.id)
      if (!r) return true
      return r.answer_boolean === null && r.answer_boolean === undefined
        && !r.answer_text && r.answer_numeric === null && !(r.answer_options?.length)
    })

    if (unanswered.length > 0) {
      toast.error(`${unanswered.length} required question${unanswered.length > 1 ? 's' : ''} still need answers`)
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('calculate_session_score', { p_session_id: session.id })
    setSubmitting(false)

    if (error) { toast.error(error.message); return }
    toast.success('Inspection submitted successfully!')
    router.push(`/inspections/${outlet.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Link href={`/inspections/${outlet.id}`} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{session.inspection_templates?.title}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Building2 className="h-3 w-3" />
                <span>{outlet.name}</span>
                {outlet.city && <span>· {outlet.city}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {flaggedCount > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  <AlertTriangle className="h-3 w-3" />
                  {flaggedCount} flagged
                </span>
              )}
              <span className="text-xs font-bold text-indigo-600">{progressPct}%</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {sections.map(section => (
          <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-left hover:bg-gray-100 transition-colors"
              onClick={() => setExpandedSections(prev => {
                const n = new Set(prev)
                n.has(section.id) ? n.delete(section.id) : n.add(section.id)
                return n
              })}
            >
              {expandedSections.has(section.id)
                ? <ChevronDown className="h-4 w-4 text-gray-400" />
                : <ChevronRight className="h-4 w-4 text-gray-400" />
              }
              <span className="font-semibold text-gray-900 text-sm flex-1">{section.title}</span>
              <span className="text-xs text-gray-400">
                {section.template_questions.filter(q => isVisible(q) && responses.has(q.id)).length}
                /{section.template_questions.filter(q => isVisible(q)).length}
              </span>
            </button>

            {expandedSections.has(section.id) && (
              <div className="divide-y divide-gray-100">
                {section.template_questions
                  .filter(q => isVisible(q))
                  .map((question, qi) => (
                    <QuestionInput
                      key={question.id}
                      question={question}
                      index={qi + 1}
                      response={responses.get(question.id)}
                      onChange={patch => saveResponse(question.id, patch)}
                    />
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-gray-500">
              {answeredRequired.length} / {visibleRequired.length} required answered
              {flaggedCount > 0 && ` · ${flaggedCount} issue${flaggedCount > 1 ? 's' : ''} will be raised`}
            </p>
          </div>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            className="min-w-[140px]"
          >
            <CheckCircle2 className="h-4 w-4" />
            Submit Inspection
          </Button>
        </div>
      </div>
    </div>
  )
}

function QuestionInput({
  question, index, response, onChange,
}: {
  question: Question
  index: number
  response: ResponsePayload | undefined
  onChange: (patch: ResponsePayload) => void
}) {
  const [showNote, setShowNote] = useState(!!response?.note)
  const isFlagged = response?.flagged

  return (
    <div className={cn('px-4 py-4', isFlagged && 'bg-amber-50/50')}>
      {/* Question text */}
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xs font-bold text-gray-400 mt-0.5 shrink-0 w-5">{index}.</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">
            {question.question_text}
            {question.is_required && <span className="text-red-500 ml-1">*</span>}
          </p>
          {question.hint_text && (
            <p className="text-xs text-gray-500 mt-0.5">{question.hint_text}</p>
          )}
          {question.reference_note && (
            <div className="flex items-start gap-1.5 mt-1.5 text-xs text-indigo-600 bg-indigo-50 rounded-lg px-2 py-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{question.reference_note}</span>
            </div>
          )}
          {isFlagged && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              An issue will be raised for this answer
            </div>
          )}
        </div>
      </div>

      {/* Answer input based on type */}
      <div className="ml-7">
        {question.question_type === 'yes_no' && (
          <div className="flex gap-3">
            {[{ v: true, label: 'Yes / Pass' }, { v: false, label: 'No / Fail' }].map(opt => (
              <button
                key={String(opt.v)}
                onClick={() => onChange({ answer_boolean: opt.v })}
                className={cn(
                  'flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all',
                  response?.answer_boolean === opt.v
                    ? opt.v
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {question.question_type === 'multiple_choice' && question.options && (
          <div className="space-y-2">
            {question.options.map(opt => (
              <button
                key={opt}
                onClick={() => onChange({ answer_text: opt })}
                className={cn(
                  'w-full text-left rounded-lg border-2 px-3 py-2.5 text-sm transition-all',
                  response?.answer_text === opt
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {question.question_type === 'multi_select' && question.options && (
          <div className="space-y-2">
            {question.options.map(opt => {
              const selected = response?.answer_options?.includes(opt) ?? false
              return (
                <button
                  key={opt}
                  onClick={() => {
                    const current = response?.answer_options ?? []
                    const next = selected ? current.filter(o => o !== opt) : [...current, opt]
                    onChange({ answer_options: next })
                  }}
                  className={cn(
                    'w-full text-left rounded-lg border-2 px-3 py-2.5 text-sm transition-all flex items-center gap-2',
                    selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  )}
                >
                  <span className={cn(
                    'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
                    selected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                  )}>
                    {selected && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </span>
                  {opt}
                </button>
              )
            })}
          </div>
        )}

        {question.question_type === 'text' && (
          <textarea
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] resize-none"
            placeholder="Enter your answer..."
            value={response?.answer_text ?? ''}
            onChange={e => onChange({ answer_text: e.target.value || null })}
          />
        )}

        {question.question_type === 'numeric' && (
          <input
            type="number"
            min={question.numeric_min ?? undefined}
            max={question.numeric_max ?? undefined}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={`Enter number${question.numeric_min !== null ? ` (min ${question.numeric_min})` : ''}${question.numeric_max !== null ? `, max ${question.numeric_max}` : ''}`}
            value={response?.answer_numeric ?? ''}
            onChange={e => onChange({ answer_numeric: e.target.value ? parseFloat(e.target.value) : null })}
          />
        )}

        {question.question_type === 'rating' && (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => onChange({ answer_numeric: n })}
                className={cn(
                  'h-10 w-10 rounded-lg border-2 text-sm font-bold transition-all',
                  response?.answer_numeric === n
                    ? 'border-indigo-500 bg-indigo-600 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {question.question_type === 'datetime' && (
          <input
            type="datetime-local"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={response?.answer_text ?? ''}
            onChange={e => onChange({ answer_text: e.target.value || null })}
          />
        )}

        {question.question_type === 'barcode' && (
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            placeholder="Scan or enter barcode..."
            value={response?.answer_text ?? ''}
            onChange={e => onChange({ answer_text: e.target.value || null })}
          />
        )}

        {(question.question_type === 'photo' || question.question_type === 'file') && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors cursor-pointer">
            {question.question_type === 'photo'
              ? <Camera className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              : <FileUp className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            }
            <p className="text-sm text-gray-500">
              {question.question_type === 'photo' ? 'Tap to take or upload photo' : 'Tap to upload file'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Photo upload requires Supabase Storage setup</p>
          </div>
        )}

        {/* Note / comment */}
        <div className="mt-2">
          {!showNote ? (
            <button
              onClick={() => setShowNote(true)}
              className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
            >
              + Add note / comment
            </button>
          ) : (
            <input
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 mt-1"
              placeholder="Optional comment or context..."
              value={response?.note ?? ''}
              onChange={e => onChange({ note: e.target.value || null })}
            />
          )}
        </div>
      </div>
    </div>
  )
}
