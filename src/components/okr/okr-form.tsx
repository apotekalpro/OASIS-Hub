'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Eye, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
type Department = { id: string; name: string }
type Team = { id: string; name: string }

type KeyResultDraft = {
  _id: string
  title: string
  metric_type: 'percentage' | 'number' | 'boolean' | 'currency'
  start_value: string
  target_value: string
  unit: string
  due_date: string
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
  }
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
  const [assigneeSearch, setAssigneeSearch] = useState('')

  // Watchers
  const [watchers, setWatchers] = useState<OrgUser[]>([])
  const [watcherSearch, setWatcherSearch] = useState('')

  // Load existing assignees/watchers when editing
  useEffect(() => {
    if (open && objective?.id) {
      fetch(`/api/okr/${objective.id}`)
        .then(r => r.ok ? r.json() : { assignees: [], watchers: [], keyResults: [] })
        .then(({ assignees: a = [], watchers: w = [], keyResults: krs = [] }: {
          assignees: Array<{ user_id: string; role: string }>
          watchers: Array<{ user_id: string }>
          keyResults: Array<{ id: string; title: string; metric_type: string; start_value: number; target_value: number; unit: string | null; due_date: string | null }>
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
      setAssigneeSearch('')
      setWatcherSearch('')
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

  const filteredAssigneeUsers = users.filter(
    u => !assignees.find(a => a.id === u.id) &&
      (u.full_name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
       u.email.toLowerCase().includes(assigneeSearch.toLowerCase()))
  )

  const filteredWatcherUsers = users.filter(
    u => !watchers.find(w => w.id === u.id) &&
      !assignees.find(a => a.id === u.id) &&
      (u.full_name.toLowerCase().includes(watcherSearch.toLowerCase()) ||
       u.email.toLowerCase().includes(watcherSearch.toLowerCase()))
  )

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
          title: kr.title.trim(),
          metric_type: kr.metric_type,
          start_value: parseFloat(kr.start_value) || 0,
          target_value: parseFloat(kr.target_value) || 100,
          unit: kr.unit.trim() || null,
          due_date: kr.due_date || null,
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
                {assignees.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {assignees.map(u => (
                      <div key={u.id} className="flex items-center gap-1.5 bg-indigo-50 rounded-full pl-1 pr-2 py-0.5">
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-5 h-5 text-xs" />
                        <span className="text-xs font-medium text-indigo-700">{u.full_name.split(' ')[0]}</span>
                        <button
                          type="button"
                          onClick={() => setAssignees(assignees.filter(a => a.id !== u.id))}
                          className="text-indigo-300 hover:text-red-500 text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  placeholder="Search and add assignees..."
                  value={assigneeSearch}
                  onChange={e => setAssigneeSearch(e.target.value)}
                />
                {assigneeSearch && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                    {filteredAssigneeUsers.slice(0, 8).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setAssignees([...assignees, u]); setAssigneeSearch('') }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      >
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6 text-xs" />
                        <span>{u.full_name}</span>
                        <span className="text-gray-400 text-xs ml-auto">{u.email}</span>
                      </button>
                    ))}
                    {filteredAssigneeUsers.length === 0 && (
                      <p className="px-3 py-2 text-sm text-gray-400">No users found</p>
                    )}
                  </div>
                )}
              </div>

              {/* Watchers / CC */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-gray-400" />
                  CC <span className="font-normal text-gray-400">(spectators — can track but are not responsible)</span>
                </label>
                {watchers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {watchers.map(u => (
                      <div key={u.id} className="flex items-center gap-1.5 bg-amber-50 rounded-full pl-1 pr-2 py-0.5">
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-5 h-5 text-xs" />
                        <span className="text-xs font-medium text-amber-700">{u.full_name.split(' ')[0]}</span>
                        <button
                          type="button"
                          onClick={() => setWatchers(watchers.filter(w => w.id !== u.id))}
                          className="text-amber-300 hover:text-red-500 text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  placeholder="Add people to CC..."
                  value={watcherSearch}
                  onChange={e => setWatcherSearch(e.target.value)}
                />
                {watcherSearch && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                    {filteredWatcherUsers.slice(0, 8).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setWatchers([...watchers, u]); setWatcherSearch('') }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      >
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6 text-xs" />
                        <span>{u.full_name}</span>
                        <span className="text-gray-400 text-xs ml-auto">{u.email}</span>
                      </button>
                    ))}
                    {filteredWatcherUsers.length === 0 && (
                      <p className="px-3 py-2 text-sm text-gray-400">No users found</p>
                    )}
                  </div>
                )}
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
