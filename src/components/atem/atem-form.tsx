'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, X, Tag, Eye } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/avatar'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { toast } from 'sonner'

const schema = z.object({
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']),
  estimated_time: z.string().optional(),
  nearest_deadline: z.string().optional(),
  dept_id: z.string().optional(),
  team_id: z.string().optional(),
})

type FormData = z.infer<typeof schema>

type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
type Department = { id: string; name: string }
type Team = { id: string; name: string }

export type ExistingAtemItem = {
  id: string
  task: string
  priority: string
  status: string
  deadline: string | null
  deadline_text: string | null
  action_plan: string | null
  impact: string | null
  dependencies: string | null
  strategic_alignment: string | null
  consequences_of_delay: string | null
  estimated_time: number | null
  dept_id: string | null
  team_id: string | null
  tags: string[]
}

interface Props {
  orgId: string
  currentUserId: string
  users: OrgUser[]
  departments: Department[]
  teams: Team[]
  item?: ExistingAtemItem
  trigger?: React.ReactNode
  onCreated?: (itemId: string) => void
}

export function AtemForm({ orgId, currentUserId, users, departments, teams, item, trigger, onCreated }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedAssignees, setSelectedAssignees] = useState<OrgUser[]>([])
  const [selectedWatchers, setSelectedWatchers] = useState<OrgUser[]>([])
  const [tags, setTags] = useState<string[]>(item?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [watcherSearch, setWatcherSearch] = useState('')
  const [taskContent, setTaskContent] = useState(item?.task ?? '')
  const [taskError, setTaskError] = useState('')
  const [deadlineText, setDeadlineText] = useState(item?.deadline_text ?? '')
  const [impact, setImpact] = useState(item?.impact ?? '')
  const [dependencies, setDependencies] = useState(item?.dependencies ?? '')
  const [strategicAlignment, setStrategicAlignment] = useState(item?.strategic_alignment ?? '')
  const [consequencesOfDelay, setConsequencesOfDelay] = useState(item?.consequences_of_delay ?? '')
  const [actionPlan, setActionPlan] = useState(item?.action_plan ?? '')

  useEffect(() => {
    if (open && item?.id) {
      fetch(`/api/atem/${item.id}`)
        .then(r => r.ok ? r.json() : { assigneeIds: [], watcherIds: [] })
        .then(({ assigneeIds = [], watcherIds = [] }: { assigneeIds: string[]; watcherIds: string[] }) => {
          setSelectedAssignees(users.filter(u => assigneeIds.includes(u.id)))
          setSelectedWatchers(users.filter(u => watcherIds.includes(u.id)))
        })
        .catch(() => {})
    }
    if (!open) {
      setSelectedAssignees([])
      setSelectedWatchers([])
      setUserSearch('')
      setWatcherSearch('')
      setTags(item?.tags ?? [])
      setTaskContent(item?.task ?? '')
      setTaskError('')
      setDeadlineText(item?.deadline_text ?? '')
      setImpact(item?.impact ?? '')
      setDependencies(item?.dependencies ?? '')
      setStrategicAlignment(item?.strategic_alignment ?? '')
      setConsequencesOfDelay(item?.consequences_of_delay ?? '')
      setActionPlan(item?.action_plan ?? '')
    }
  }, [open, item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: item ? {
      priority: item.priority as FormData['priority'],
      status: item.status as FormData['status'],
      nearest_deadline: item.deadline ? item.deadline.split('T')[0] : '',
      estimated_time: item.estimated_time?.toString() ?? '',
      dept_id: item.dept_id ?? '',
      team_id: item.team_id ?? '',
    } : {
      priority: 'medium',
      status: 'pending',
    },
  })

  async function onSubmit(data: FormData) {
    const plainTask = taskContent.replace(/<[^>]*>/g, '').trim()
    if (!plainTask) { setTaskError('Task is required'); return }
    setTaskError('')
    try {
      const payload = {
        task: taskContent,
        priority: data.priority,
        status: data.status,
        deadline_text: deadlineText || null,
        deadline: data.nearest_deadline ? new Date(data.nearest_deadline).toISOString() : null,
        impact: impact || null,
        dependencies: dependencies || null,
        strategic_alignment: strategicAlignment || null,
        consequences_of_delay: consequencesOfDelay || null,
        estimated_time: data.estimated_time ? parseFloat(data.estimated_time) : null,
        action_plan: actionPlan || null,
        dept_id: data.dept_id || null,
        team_id: data.team_id || null,
        tags,
        assigneeIds: selectedAssignees.map(u => u.id),
        watcherIds: selectedWatchers.map(u => u.id),
      }

      if (item?.id) {
        const res = await fetch(`/api/atem/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success('ATEM item updated')
      } else {
        const res = await fetch('/api/atem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, org_id: orgId }),
        })
        const resData = await res.json()
        if (!res.ok) throw new Error(resData.error)
        toast.success('ATEM item created')
        onCreated?.(resData.item?.id)
      }

      setOpen(false)
      reset()
      setSelectedAssignees([])
      setSelectedWatchers([])
      setTags([])
      setTaskContent('')
      setDeadlineText('')
      setImpact('')
      setDependencies('')
      setStrategicAlignment('')
      setConsequencesOfDelay('')
      setActionPlan('')
      if (!onCreated) router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  const filteredUsers = users.filter(
    u => !selectedAssignees.find(a => a.id === u.id) &&
      (u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
       u.email.toLowerCase().includes(userSearch.toLowerCase()))
  )

  const filteredWatchers = users.filter(
    u => !selectedWatchers.find(w => w.id === u.id) &&
      !selectedAssignees.find(a => a.id === u.id) &&
      (u.full_name.toLowerCase().includes(watcherSearch.toLowerCase()) ||
       u.email.toLowerCase().includes(watcherSearch.toLowerCase()))
  )

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> New ATEM Item</Button>}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <Dialog.Title className="text-lg font-semibold">
              {item ? 'Edit ATEM Item' : 'New ATEM Item'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto flex-1 p-6">
            <form id="atem-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* T — Task */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5 text-xs font-bold">T</span>
                    Task *
                  </span>
                </label>
                <RichTextEditor value={taskContent} onChange={setTaskContent} placeholder="Describe the action to be taken..." />
                {taskError && <p className="text-xs text-red-500 mt-1">{taskError}</p>}
              </div>

              {/* Priority / Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('priority')}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('status')}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>

              {/* D — Deadline (free text, rich) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bg-orange-100 text-orange-700 rounded px-1.5 py-0.5 text-xs font-bold">D</span>
                    Deadline
                  </span>
                </label>
                <RichTextEditor value={deadlineText} onChange={setDeadlineText} placeholder="e.g. Frontend: 15 Jan, Backend: 1 Feb, Deployment: 15 Feb" />
              </div>

              {/* I — Impact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bg-green-100 text-green-700 rounded px-1.5 py-0.5 text-xs font-bold">I</span>
                    Impact
                  </span>
                </label>
                <RichTextEditor value={impact} onChange={setImpact} placeholder="What impact will completing this have?" />
              </div>

              {/* D2 — Dependencies */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bg-yellow-100 text-yellow-700 rounded px-1.5 py-0.5 text-xs font-bold">D</span>
                    Dependencies
                  </span>
                </label>
                <RichTextEditor value={dependencies} onChange={setDependencies} placeholder="What does this depend on? What blocks this?" />
              </div>

              {/* S — Strategic Alignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 text-xs font-bold">S</span>
                    Strategic Alignment
                  </span>
                </label>
                <RichTextEditor value={strategicAlignment} onChange={setStrategicAlignment} placeholder="How does this align with strategic objectives?" />
              </div>

              {/* C — Consequences of Delay */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bg-red-100 text-red-700 rounded px-1.5 py-0.5 text-xs font-bold">C</span>
                    Consequences of Delay
                  </span>
                </label>
                <RichTextEditor value={consequencesOfDelay} onChange={setConsequencesOfDelay} placeholder="What happens if this is delayed or not done?" />
              </div>

              {/* E — Estimated Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 text-xs font-bold">E</span>
                    Estimated Time (days)
                  </span>
                </label>
                <Input type="number" step="0.5" min="0" placeholder="0" {...register('estimated_time')} />
              </div>

              {/* Nearest Deadline */}
              <div className="border-t border-gray-100 pt-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-gray-500 text-xs">⏰</span>
                    Nearest Deadline
                    <span className="text-xs font-normal text-gray-400">(for reminder &amp; countdown)</span>
                  </span>
                </label>
                <Input type="date" {...register('nearest_deadline')} />
              </div>

              {/* Action Plan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action Plan</label>
                <RichTextEditor
                  value={actionPlan}
                  onChange={setActionPlan}
                  placeholder="Outline the step-by-step action plan..."
                />
              </div>

              {/* Dept / Team */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('dept_id')}>
                    <option value="">— None —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                  <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('team_id')}>
                    <option value="">— None —</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-0.5 text-xs font-medium">
                      <Tag className="h-3 w-3" />
                      {tag}
                      <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add tag..."
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
                </div>
              </div>

              {/* Assignees */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assignees</label>
                {selectedAssignees.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedAssignees.map(u => (
                      <div key={u.id} className="flex items-center gap-1.5 bg-indigo-50 rounded-full pl-1 pr-2 py-0.5">
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-5 h-5 text-xs" />
                        <span className="text-xs font-medium text-indigo-700">{u.full_name.split(' ')[0]}</span>
                        <button type="button" onClick={() => setSelectedAssignees(selectedAssignees.filter(a => a.id !== u.id))} className="text-indigo-300 hover:text-red-500 text-xs">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  placeholder="Search and add assignees..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
                {userSearch && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                    {filteredUsers.slice(0, 8).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setSelectedAssignees([...selectedAssignees, u]); setUserSearch('') }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      >
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6 text-xs" />
                        <span>{u.full_name}</span>
                        <span className="text-gray-400 text-xs ml-auto">{u.email}</span>
                      </button>
                    ))}
                    {filteredUsers.length === 0 && (
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
                {selectedWatchers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedWatchers.map(u => (
                      <div key={u.id} className="flex items-center gap-1.5 bg-amber-50 rounded-full pl-1 pr-2 py-0.5">
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-5 h-5 text-xs" />
                        <span className="text-xs font-medium text-amber-700">{u.full_name.split(' ')[0]}</span>
                        <button type="button" onClick={() => setSelectedWatchers(selectedWatchers.filter(w => w.id !== u.id))} className="text-amber-300 hover:text-red-500 text-xs">×</button>
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
                    {filteredWatchers.slice(0, 8).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setSelectedWatchers([...selectedWatchers, u]); setWatcherSearch('') }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      >
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6 text-xs" />
                        <span>{u.full_name}</span>
                        <span className="text-gray-400 text-xs ml-auto">{u.email}</span>
                      </button>
                    ))}
                    {filteredWatchers.length === 0 && (
                      <p className="px-3 py-2 text-sm text-gray-400">No users found</p>
                    )}
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <Dialog.Close asChild>
              <Button variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button type="submit" form="atem-form" loading={isSubmitting}>
              {item ? 'Save Changes' : 'Create ATEM Item'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
