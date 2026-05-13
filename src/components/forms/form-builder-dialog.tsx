'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, GripVertical, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'radio' | 'date' | 'photo' | 'signature' | 'rating'

interface FormField {
  id: string
  type: FieldType
  label: string
  required: boolean
  options?: string[]
  max?: number
  placeholder?: string
  points?: number
}

type Template = {
  id: string; title: string; description: string | null; is_active: boolean
  passing_score: number | null; created_at: string; dept_id: string | null
  departments?: { name: string } | null
}

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: 'text', label: 'Short Text', icon: '📝' },
  { value: 'textarea', label: 'Long Text', icon: '📄' },
  { value: 'number', label: 'Number', icon: '🔢' },
  { value: 'select', label: 'Dropdown', icon: '📋' },
  { value: 'radio', label: 'Multiple Choice', icon: '⚪' },
  { value: 'checkbox', label: 'Checkboxes', icon: '☑️' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'rating', label: 'Rating (1–5)', icon: '⭐' },
  { value: 'photo', label: 'Photo Upload', icon: '📷' },
]

function uid() { return Math.random().toString(36).slice(2) }

interface Props {
  orgId: string
  currentUserId: string
  departments: Array<{ id: string; name: string }>
  template?: Template
  onCreated: (t: Template) => void
  trigger?: React.ReactNode
}

export function FormBuilderDialog({ orgId, currentUserId, departments, template, onCreated, trigger }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(template?.title ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [deptId, setDeptId] = useState(template?.dept_id ?? '')
  const [passingScore, setPassingScore] = useState(template?.passing_score?.toString() ?? '')
  const [fields, setFields] = useState<FormField[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingFields, setLoadingFields] = useState(false)

  async function loadExistingFields() {
    if (!template) return
    setLoadingFields(true)
    const { data } = await supabase.from('form_templates').select('fields').eq('id', template.id).single()
    if (data) setFields((data as { fields: FormField[] }).fields ?? [])
    setLoadingFields(false)
  }

  function handleOpen(v: boolean) {
    setOpen(v)
    if (v && template) loadExistingFields()
    if (!v) {
      if (!template) { setTitle(''); setDescription(''); setFields([]); setPassingScore(''); setDeptId('') }
    }
  }

  function addField(type: FieldType) {
    const field: FormField = {
      id: uid(), type, label: '', required: false, points: 0,
      ...(type === 'select' || type === 'radio' || type === 'checkbox' ? { options: [''] } : {}),
      ...(type === 'rating' ? { max: 5 } : {}),
    }
    setFields(prev => [...prev, field])
  }

  function updateField(id: string, updates: Partial<FormField>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  function moveField(id: string, dir: -1 | 1) {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === id)
      if (idx + dir < 0 || idx + dir >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
      return next
    })
  }

  async function save() {
    if (!title.trim()) { toast.error('Title is required'); return }
    if (fields.some(f => !f.label.trim())) { toast.error('All fields must have a label'); return }
    setLoading(true)

    const payload = {
      org_id: orgId,
      title: title.trim(),
      description: description.trim() || null,
      dept_id: deptId || null,
      passing_score: passingScore ? parseFloat(passingScore) : null,
      fields,
      created_by: currentUserId,
    }

    let result
    if (template) {
      result = await supabase.from('form_templates').update(payload).eq('id', template.id).select('id, title, description, is_active, passing_score, created_at, dept_id').single()
    } else {
      result = await supabase.from('form_templates').insert(payload).select('id, title, description, is_active, passing_score, created_at, dept_id').single()
    }

    if (result.error) { toast.error(result.error.message); setLoading(false); return }

    const saved = result.data as Template
    onCreated(saved)
    toast.success(template ? 'Form updated' : 'Form created')
    setOpen(false)
    if (!template) { setTitle(''); setDescription(''); setFields([]); setPassingScore(''); setDeptId('') }
    setLoading(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpen}>
      <Dialog.Trigger asChild>{trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> New Form</Button>}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-3xl bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <Dialog.Title className="text-lg font-semibold">{template ? 'Edit Form' : 'Create New Form'}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Form Title *</label>
                <Input placeholder="e.g. Daily Safety Inspection" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="What is this form for?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={deptId} onChange={e => setDeptId(e.target.value)}>
                  <option value="">— All Departments —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score (%)</label>
                <Input type="number" min="0" max="100" placeholder="e.g. 80" value={passingScore} onChange={e => setPassingScore(e.target.value)} />
              </div>
            </div>

            {/* Fields */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Form Fields</h3>
                <span className="text-xs text-gray-400">{fields.length} fields</span>
              </div>

              {loadingFields ? (
                <div className="text-center py-6 text-gray-400 text-sm">Loading fields...</div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, idx) => (
                    <FieldEditor
                      key={field.id}
                      field={field}
                      index={idx}
                      total={fields.length}
                      onChange={updates => updateField(field.id, updates)}
                      onRemove={() => removeField(field.id)}
                      onMove={dir => moveField(field.id, dir)}
                    />
                  ))}
                </div>
              )}

              {/* Add field buttons */}
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Add Field</p>
                <div className="flex flex-wrap gap-2">
                  {FIELD_TYPES.map(ft => (
                    <button
                      key={ft.value}
                      type="button"
                      onClick={() => addField(ft.value)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    >
                      <span>{ft.icon}</span>{ft.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <Dialog.Close asChild><Button variant="outline">Cancel</Button></Dialog.Close>
            <Button onClick={save} loading={loading} disabled={!title.trim()}>
              {template ? 'Save Changes' : 'Create Form'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function FieldEditor({ field, index, total, onChange, onRemove, onMove }: {
  field: FormField; index: number; total: number
  onChange: (u: Partial<FormField>) => void
  onRemove: () => void
  onMove: (d: -1 | 1) => void
}) {
  const hasOptions = field.type === 'select' || field.type === 'radio' || field.type === 'checkbox'

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
        <div className="flex-1 grid grid-cols-2 gap-2">
          <Input
            placeholder="Field label *"
            value={field.label}
            onChange={e => onChange({ label: e.target.value })}
          />
          <select
            value={field.type}
            onChange={e => onChange({ type: e.target.value as FieldType })}
            className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={field.required} onChange={e => onChange({ required: e.target.checked })} className="rounded" />
          Required
        </label>
        <div className="flex items-center gap-1.5">
          <label className="text-sm text-gray-600">Points:</label>
          <input
            type="number"
            min="0"
            value={field.points ?? 0}
            onChange={e => onChange({ points: parseInt(e.target.value) || 0 })}
            className="w-16 h-7 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        {(field.type === 'text' || field.type === 'textarea') && (
          <Input
            placeholder="Placeholder text"
            value={field.placeholder ?? ''}
            onChange={e => onChange({ placeholder: e.target.value })}
            className="flex-1 h-7 text-sm"
          />
        )}
      </div>

      {hasOptions && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500">Options</p>
          {(field.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={e => {
                  const opts = [...(field.options ?? [])]
                  opts[i] = e.target.value
                  onChange({ options: opts })
                }}
                className="flex-1 h-7 text-sm"
              />
              <button
                type="button"
                onClick={() => onChange({ options: (field.options ?? []).filter((_, j) => j !== i) })}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ options: [...(field.options ?? []), ''] })}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
          >
            <Plus className="h-3 w-3" /> Add option
          </button>
        </div>
      )}
    </div>
  )
}
