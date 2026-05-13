'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, CheckCircle2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface FormField {
  id: string; type: string; label: string; required: boolean
  options?: string[]; max?: number; placeholder?: string; points?: number
}

interface Props {
  form: { id: string; title: string; description: string | null; fields: object[]; passing_score: number | null }
  existingSubmission: { id: string; answers: Record<string, unknown>; status: string } | null
  assignmentId: string | null
  currentUserId: string
}

export function FormSubmitClient({ form, existingSubmission, assignmentId, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fields = form.fields as FormField[]

  const [answers, setAnswers] = useState<Record<string, unknown>>(
    existingSubmission?.answers ?? {}
  )
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(existingSubmission?.status === 'submitted')

  function setAnswer(fieldId: string, value: unknown) {
    setAnswers(prev => ({ ...prev, [fieldId]: value }))
  }

  function toggleCheckbox(fieldId: string, option: string) {
    const current = (answers[fieldId] as string[]) ?? []
    const updated = current.includes(option)
      ? current.filter(v => v !== option)
      : [...current, option]
    setAnswer(fieldId, updated)
  }

  function computeScore(): number | null {
    const totalPoints = fields.reduce((s, f) => s + (f.points ?? 0), 0)
    if (totalPoints === 0) return null

    let earned = 0
    fields.forEach(f => {
      if (!answers[f.id] || answers[f.id] === '' || (Array.isArray(answers[f.id]) && (answers[f.id] as unknown[]).length === 0)) return
      earned += f.points ?? 0
    })
    return Math.round((earned / totalPoints) * 100)
  }

  async function upsert(status: 'draft' | 'submitted') {
    const score = status === 'submitted' ? computeScore() : null
    const payload = {
      form_id: form.id,
      assignment_id: assignmentId,
      submitted_by: currentUserId,
      answers,
      status,
      score,
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
    }

    if (existingSubmission?.id) {
      return supabase.from('form_submissions').update(payload).eq('id', existingSubmission.id)
    } else {
      return supabase.from('form_submissions').insert(payload)
    }
  }

  async function saveDraft() {
    setSaving(true)
    const { error } = await upsert('draft')
    if (error) toast.error(error.message)
    else toast.success('Draft saved')
    setSaving(false)
  }

  async function submit() {
    // Validate required fields
    const missing = fields.filter(f => {
      if (!f.required) return false
      const val = answers[f.id]
      return !val || val === '' || (Array.isArray(val) && val.length === 0)
    })
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.map(f => f.label).join(', ')}`)
      return
    }

    setSubmitting(true)
    const { error } = await upsert('submitted')
    if (error) { toast.error(error.message); setSubmitting(false); return }

    const score = computeScore()
    setSubmitted(true)
    setSubmitting(false)

    toast.success(score !== null
      ? `Submitted! Score: ${score}%${form.passing_score ? (score >= form.passing_score ? ' ✓ Passed' : ' ✗ Failed') : ''}`
      : 'Form submitted successfully')
  }

  if (submitted) {
    const score = computeScore()
    const passed = score !== null && form.passing_score !== null ? score >= form.passing_score : null

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Form Submitted</h2>
          {score !== null && (
            <div className={cn('text-3xl font-bold', passed === true ? 'text-green-600' : passed === false ? 'text-red-600' : 'text-gray-900')}>
              {score}%
              {passed !== null && <span className="text-base ml-2 font-medium">{passed ? '— Passed' : '— Failed'}</span>}
            </div>
          )}
          {form.passing_score && <p className="text-sm text-gray-500">Passing score: {form.passing_score}%</p>}
          <p className="text-sm text-gray-500">Your submission is being reviewed.</p>
          <Link href="/forms">
            <Button className="w-full">Back to Forms</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/forms" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Forms
        </Link>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h1 className="text-xl font-bold text-gray-900">{form.title}</h1>
          {form.description && <p className="text-gray-500 text-sm mt-1">{form.description}</p>}
          {form.passing_score && <p className="text-xs text-gray-400 mt-1">Passing score: {form.passing_score}%</p>}
        </div>

        <div className="space-y-4">
          {fields.map((field, idx) => (
            <div key={field.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <label className="block text-sm font-medium text-gray-800 mb-2">
                {idx + 1}. {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
                {(field.points ?? 0) > 0 && <span className="text-xs text-gray-400 ml-2">{field.points} pts</span>}
              </label>

              {field.type === 'text' && (
                <Input
                  placeholder={field.placeholder}
                  value={(answers[field.id] as string) ?? ''}
                  onChange={e => setAnswer(field.id, e.target.value)}
                />
              )}

              {field.type === 'textarea' && (
                <textarea
                  rows={4}
                  placeholder={field.placeholder}
                  value={(answers[field.id] as string) ?? ''}
                  onChange={e => setAnswer(field.id, e.target.value)}
                  className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              )}

              {field.type === 'number' && (
                <Input
                  type="number"
                  placeholder={field.placeholder}
                  value={(answers[field.id] as string) ?? ''}
                  onChange={e => setAnswer(field.id, e.target.value)}
                  className="max-w-xs"
                />
              )}

              {field.type === 'date' && (
                <Input
                  type="date"
                  value={(answers[field.id] as string) ?? ''}
                  onChange={e => setAnswer(field.id, e.target.value)}
                  className="max-w-xs"
                />
              )}

              {field.type === 'select' && (
                <select
                  value={(answers[field.id] as string) ?? ''}
                  onChange={e => setAnswer(field.id, e.target.value)}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select —</option>
                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}

              {field.type === 'radio' && (
                <div className="space-y-2">
                  {field.options?.map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={field.id}
                        value={opt}
                        checked={(answers[field.id] as string) === opt}
                        onChange={() => setAnswer(field.id, opt)}
                        className="text-indigo-600"
                      />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'checkbox' && (
                <div className="space-y-2">
                  {field.options?.map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={((answers[field.id] as string[]) ?? []).includes(opt)}
                        onChange={() => toggleCheckbox(field.id, opt)}
                        className="rounded text-indigo-600"
                      />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'rating' && (
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].slice(0, field.max ?? 5).map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAnswer(field.id, n)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={cn('h-8 w-8', (answers[field.id] as number) >= n ? 'fill-amber-400 text-amber-400' : 'text-gray-300')}
                      />
                    </button>
                  ))}
                  {answers[field.id] !== undefined && (
                    <span className="ml-2 text-sm text-gray-500 self-center">{String(answers[field.id])}/5</span>
                  )}
                </div>
              )}

              {field.type === 'photo' && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-400">
                  Photo upload (configure Supabase Storage to enable)
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between gap-3">
          <Button variant="outline" onClick={saveDraft} loading={saving}>Save Draft</Button>
          <Button onClick={submit} loading={submitting}>Submit Form</Button>
        </div>
      </div>
    </div>
  )
}
