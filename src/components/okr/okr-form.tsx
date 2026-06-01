'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Eye, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { AssigneePicker, type PickerUser } from '@/components/ui/assignee-picker'

type OrgUser = PickerUser
type Department = { id: string; name: string }
type Team = { id: string; name: string; team_members?: Array<{ user_id: string; profiles?: OrgUser | null }> }

type SubtaskDraft = { _id: string; title: string; priority: 'low' | 'medium' | 'high' }

type KeyResultDraft = {
  _id: string
  title: string
  metric_type: 'percentage' | 'number' | 'boolean' | 'currency'
  start_value: string
  target_value: string
  unit: string
  due_date: string
  description: string
  subtasks: SubtaskDraft[]
}

type ExistingObjective = {
  id: string
  title: string
  description: string | null
  period_type: string
  period_label: string | null
  start_date: string | null
  end_date: string | null
  status: string
  dept_id: string | null
  team_id: string | null
}

interface Props {
  orgId: string
  currentUserId: string
  users: OrgUser[]
  departments: Department[]
  teams: Team[]
  objective?: ExistingObjective
  trigger?: React.ReactNode
  onCreated?: () => void
}

const METRIC_LABELS = {
  percentage: '% Percentage',
  number: '# Number',
  boolean: '✓ Boolean (done/not done)',
  currency: '$ Currency',
}

function newKrDraft(): KeyResultDraft {
  return {
    _id: Math.random().toString(36).slice(2),
    title: '',
    metric_type: 'percentage',
    start_value: '0',
    target_value: '100',
    unit: '',
    due_date: '',
    description: '',
    subtasks: [],
  }
}

function newSubtaskDraft(): SubtaskDraft {
  return { _id: Math.random().toString(36).slice(2), title: '', priority: 'medium' }
}

export function OkrForm({ orgId, currentUserId, users, departments, teams, objective, trigger, onCreated }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [title, setTitle] = useState(objective?.title ?? '')
  const [description, setDescription] = useState(objective?.description ?? '')
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'annual'>(
    (objective?.period_type as 'monthly' | 'quarterly' | 'annual') ?? 'quarterly'
  )
  const [periodLabel, setPeriodLabel] = useState(objective?.period_label ?? '')
  const [startDate, setStartDate] = useState(objective?.start_date ? objective.start_date.split('T')[0] : '')
  const [endDate, setEndDate] = useState(objective?.end_date ? objective.end_date.split('T')[0] : '')
  const [status, setStatus] = useState(objective?.status ?? 'on_track')
  const [deptId, setDeptId] = useState(objective?.dept_id ?? '')
  const [teamId, setTeamId] = useState(objective?.team_id ?? '')

  // Key Results
  const [keyResults, setKeyResults] = useState<KeyResultDraft[]>([newKrDraft()])
  const [krExpanded, setKrExpanded] = useState<Record<string, boolean>>({})

  // Assignees
  const [assignees, setAssignees] = useState<OrgUser[]>([])

  // Watchers
  const [watchers, setWatchers] = useState<OrgUser[]>([])

  // Load existing assignees/watchers when editing
  useEffect(() => {
    if (open && objective?.id) {
      fetch(`/api/okr/${objective.id}`)
        .then(r => r.ok ? r.json() : { assignees: [], watchers: [], keyResults: [] })
        .then(({ assignees: a = [], watchers: w = [], keyResults: krs = [] }: {
          assignees: Array<{ user_id: string; role: string }>
          watchers: Array<{ user_id: string }>
          keyResults: Array<{ id: string; title: string; description: string | null; metric_type: string; start_value: number; target_value: number; unit: string | null; due_date: string | null; subtasks?: Array<{ id: string; title: string; priority: string }> }>
        }) => {
          setAssignees(users.filter(u => a.some((x: { user_id: string }) => x.user_id === u.id)))
          setWatchers(users.filter(u => w.some((x: { user_id: string }) => x.user_id === u.id)))
          if (krs.length > 0) {
            setKeyResults(krs.map(kr => ({
              _id: kr.id,
              title: kr.title,
              metric_type: kr.metric_type as KeyResultDraft['metric_type'],
              start_value: String(kr.start_value),
              target_value: String(kr.target_value),
              unit: kr.unit ?? '',
              due_date: kr.due_date ?? '',
              description: kr.description ?? '',
              subtasks: (kr.subtasks ?? []).map(s => ({ _id: s.id, title: s.title, priority: s.priority as SubtaskDraft['priority'] })),
            })))
          }
        })
        .catch(() => {})
    }
    if (!open) {
      // Reset on close
      setTitle(objective?.title ?? '')
      setDescription(objective?.description ?? '')
      setPeriodType((objective?.period_type as 'monthly' | 'quarterly' | 'annual') ?? 'quarterly')
      setPeriodLabel(objective?.period_label ?? '')
      setStartDate(objective?.start_date ? objective.start_date.split('T')[0] : '')
      setEndDate(objective?.end_date ? objective.end_date.split('T')[0] : '')
      setStatus(objective?.status ?? 'on_track')
      setDeptId(objective?.dept_id ?? '')
      setTeamId(objective?.team_id ?? '')
      if (!objective) {
        setKeyResults([newKrDraft()])
        setAssignees([])
        setWatchers([])
      }
      setKrExpanded({})
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function addKr() {
    const kr = newKrDraft()
    setKeyResults(prev => [...prev, kr])
    setKrExpanded(prev => ({ ...prev, [kr._id]: true }))
  }

  function removeKr(id: string) {
    setKeyResults(prev => prev.filter(kr => kr._id !== id))
  }

  function updateKr(id: string, field: keyof KeyResultDraft, value: string) {
    setKeyResults(prev => prev.map(kr => kr._id === id ? { ...kr, [field]: value } : kr))
  }

  function addSubtask(krId: string) {
    const st = newSubtaskDraft()
    setKeyResults(prev => prev.map(kr => kr._id === krId ? { ...kr, subtasks: [...kr.subtasks, st] } : kr))
  }

  function removeSubtask(krId: string, stId: string) {
    setKeyResults(prev => prev.map(kr => kr._id === krId ? { ...kr, subtasks: kr.subtasks.filter(s => s._id !== stId) } : kr))
  }

  function updateSubtask(krId: string, stId: string, field: keyof SubtaskDraft, value: string) {
    setKeyResults(prev => prev.map(kr =>
      kr._id === krId ? { ...kr, subtasks: kr.subtasks.map(s => s._id === stId ? { ...s, [field]: value } : s) } : kr
    ))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Title is required'); return }

    const validKrs = keyResults.filter(kr => kr.title.trim())
    if (keyResults.some(kr => !kr.title.trim())) {
      toast.error('All key results must have a title, or remove the empty ones')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        period_type: periodType,
        period_label: periodLabel.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        status,
        dept_id: deptId || null,
        team_id: teamId || null,
        assigneeIds: assignees.map(u => u.id),
        watcherIds: watchers.map(u => u.id),
        keyResults: validKrs.map(kr => ({
          ...(kr._id ? { id: kr._id } : {}),
          title: kr.title.trim(),
          metric_type: kr.metric_type,
          start_value: parseFloat(kr.start_value) || 0,
          target_value: parseFloat(kr.target_value) || 100,
          unit: kr.unit.trim() || null,
          due_date: kr.due_date || null,
          description: kr.description || null,
          subtasks: kr.subtasks.filter(s => s.title.trim()).map(s => ({
            ...(s._id ? { id: s._id } : {}),
            title: s.title.trim(),
            priority: s.priority,
          })),
        })),
      }

      if (objective?.id) {
        const res = await fetch(`/api/okr/${objective.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success('Objective updated')
      } else {
        const res = await fetch('/api/okr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success('Objective created')
      }

      setOpen(false)
      onCreated?.()
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            New Objective
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
            <Dialog.Title className="text-lg font-semibold">
              {objective ? 'Edit Objective' : 'Create New Objective'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto flex-1 p-6">
            <form id="okr-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objective Title *</label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="What do you want to achieve?"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <RichTextEditor value={description} onChange={setDescription} placeholder="Why does this objective matter?" />
              </div>

              {/* Period / Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
                  <select
                    value={periodType}
                    onChange={e => setPeriodType(e.target.value as 'monthly' | 'quarterly' | 'annual')}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period Label</label>
                  <Input
                    value={periodLabel}
                    onChange={e => setPeriodLabel(e.target.value)}
                    placeholder="e.g. Q2 2026, Jan 2026"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="on_track">On Track</option>
                    <option value="at_risk">At Risk</option>
                    <option value="behind">Behind</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Dept / Team */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={deptId}
                    onChange={e => setDeptId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— None —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                  <select
                    value={teamId}
                    onChange={e => setTeamId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— None —</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Key Results */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Key Results</label>
                  <button
                    type="button"
                    onClick={addKr}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add KR
                  </button>
                </div>
                <div className="space-y-2">
                  {keyResults.map((kr, idx) => {
                    const expanded = krExpanded[kr._id] !== false
                    return (
                      <div key={kr._id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                          <span className="text-xs font-semibold text-gray-500 shrink-0">KR {idx + 1}</span>
                          <input
                            type="text"
                            value={kr.title}
                            onChange={e => updateKr(kr._id, 'title', e.target.value)}
                            placeholder="Key result title..."
                            className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
                          />
                          <button
                            type="button"
                            onClick={() => setKrExpanded(prev => ({ ...prev, [kr._id]: !expanded }))}
                            className="text-gray-400 hover:text-gray-600 shrink-0"
                          >
                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                          {keyResults.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeKr(kr._id)}
                              className="text-gray-300 hover:text-red-500 shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {expanded && (
                          <div className="px-3 pb-3 pt-2 grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Metric Type</label>
                              <select
                                value={kr.metric_type}
                                onChange={e => updateKr(kr._id, 'metric_type', e.target.value)}
                                className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                {Object.entries(METRIC_LABELS).map(([v, l]) => (
                                  <option key={v} value={v}>{l}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Unit (optional)</label>
                              <input
                                type="text"
                                value={kr.unit}
                                onChange={e => updateKr(kr._id, 'unit', e.target.value)}
                                placeholder={kr.metric_type === 'currency' ? 'MYR' : kr.metric_type === 'percentage' ? '%' : 'units'}
                                className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400"
                              />
                            </div>
                            {kr.metric_type !== 'boolean' && (
                              <>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Start Value</label>
                                  <input
                                    type="number"
                                    value={kr.start_value}
                                    onChange={e => updateKr(kr._id, 'start_value', e.target.value)}
                                    className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Target Value</label>
                                  <input
                                    type="number"
                                    value={kr.target_value}
                                    onChange={e => updateKr(kr._id, 'target_value', e.target.value)}
                                    className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                              </>
                            )}
                            <div className="col-span-2">
                              <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                              <input
                                type="date"
                                value={kr.due_date}
                                onChange={e => updateKr(kr._id, 'due_date', e.target.value)}
                                className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs text-gray-500 mb-1">Description</label>
                              <RichTextEditor
                                value={kr.description}
                                onChange={val => updateKr(kr._id, 'description', val)}
                                placeholder="Describe what achieving this key result means..."
                              />
                            </div>

                            {/* Subtasks */}
                            <div className="col-span-2">
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs text-gray-500">Subtasks</label>
                                <button
                                  type="button"
                                  onClick={() => addSubtask(kr._id)}
                                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                  <Plus className="h-3 w-3" /> Add subtask
                                </button>
                              </div>
                              {kr.subtasks.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No subtasks yet. Click "Add subtask" to add tasks linked to this KR.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {kr.subtasks.map(st => (
                                    <div key={st._id} className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={st.title}
                                        onChange={e => updateSubtask(kr._id, st._id, 'title', e.target.value)}
                                        placeholder="Subtask title..."
                                        className="flex-1 h-7 rounded border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-gray-400"
                                      />
                                      <select
                                        value={st.priority}
                                        onChange={e => updateSubtask(kr._id, st._id, 'priority', e.target.value)}
                                        className="h-7 rounded border border-gray-200 bg-white px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                      >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => removeSubtask(kr._id, st._id)}
                                        className="text-gray-300 hover:text-red-500 shrink-0"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Assignees */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owners / Assignees</label>
                <AssigneePicker
                  users={users}
                  teams={teams}
                  departments={departments}
                  selected={assignees}
                  onChange={setAssignees}
                  pillColor="indigo"
                />
              </div>

              {/* Watchers / CC */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-gray-400" />
                  CC <span className="font-normal text-gray-400">(spectators — can track but are not responsible)</span>
                </label>
                <AssigneePicker
                  users={users}
                  teams={teams}
                  departments={departments}
                  selected={watchers}
                  excluded={assignees}
                  onChange={setWatchers}
                  placeholder="Add people to CC..."
                  pillColor="amber"
                />
              </div>
            </form>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
            <Dialog.Close asChild>
              <Button variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button type="submit" form="okr-form" loading={submitting}>
              {objective ? 'Save Changes' : 'Create Objective'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Utility export for status badge colors used across OKR components
export const OKR_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'> = {
  on_track: 'success',
  at_risk: 'warning',
  behind: 'destructive',
  completed: 'secondary',
  cancelled: 'outline',
}

export const OKR_STATUS_LABEL: Record<string, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  behind: 'Behind',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function krProgressPct(kr: {
  metric_type: string
  start_value: number
  target_value: number
  current_value: number
}): number {
  if (kr.metric_type === 'boolean') return kr.current_value >= 1 ? 100 : 0
  const range = kr.target_value - kr.start_value
  if (range === 0) return 0
  return Math.min(100, Math.max(0, ((kr.current_value - kr.start_value) / range) * 100))
}

export function formatKrValue(kr: {
  metric_type: string
  current_value: number
  target_value: number
  unit: string | null
}): string {
  if (kr.metric_type === 'boolean') {
    return kr.current_value >= 1 ? 'Done' : 'Not done'
  }
  const unit = kr.unit ? ` ${kr.unit}` : ''
  if (kr.metric_type === 'percentage') {
    return `${kr.current_value}% / ${kr.target_value}%`
  }
  if (kr.metric_type === 'currency') {
    return `${kr.current_value}${unit} / ${kr.target_value}${unit}`
  }
  return `${kr.current_value}${unit} / ${kr.target_value}${unit}`
}

export function getProgressColor(pct: number): string {
  if (pct >= 70) return 'bg-green-500'
  if (pct >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

export { cn }
