'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, X, Tag, Eye, Users } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/avatar'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'cancelled']),
  due_date: z.string().optional(),
  start_date: z.string().optional(),
  estimated_hours: z.string().optional(),
  team_id: z.string().optional(),
  dept_id: z.string().optional(),
})

type FormData = z.infer<typeof schema>

type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
type Team = { id: string; name: string; team_members?: Array<{ user_id: string; profiles?: OrgUser | null }> }
type Department = { id: string; name: string }
type ExistingTask = {
  id: string; title: string; description: string | null; priority: string; status: string;
  due_date: string | null; start_date: string | null; estimated_hours: number | null;
  team_id: string | null; dept_id: string | null; tags: string[]
}

interface Props {
  orgId: string
  currentUserId: string
  users: OrgUser[]
  teams: Team[]
  departments: Department[]
  task?: ExistingTask
  defaultStatus?: string
  trigger?: React.ReactNode
  onCreated?: (taskId: string) => void
}

export function TaskForm({ orgId, currentUserId, users, teams, departments, task, defaultStatus, trigger, onCreated }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedAssignees, setSelectedAssignees] = useState<OrgUser[]>([])
  const [selectedCC, setSelectedCC] = useState<OrgUser[]>([])
  const [description, setDescription] = useState<string>(task?.description ?? '')
  const [tags, setTags] = useState<string[]>(task?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [ccSearch, setCcSearch] = useState('')

  // Load existing watchers when editing
  useEffect(() => {
    if (open && task?.id) {
      const supabase = createClient()
      supabase
        .from('task_watchers')
        .select('user_id')
        .eq('task_id', task.id)
        .then(({ data }) => {
          const watcherIds = data?.map(w => w.user_id) ?? []
          setSelectedCC(users.filter(u => watcherIds.includes(u.id)))
        })
    }
    if (!open) {
      setSelectedCC([])
      setSelectedAssignees([])
      setUserSearch('')
      setCcSearch('')
      setDescription(task?.description ?? '')
    }
  }, [open, task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: task ? {
      title: task.title,
      priority: task.priority as FormData['priority'],
      status: task.status as FormData['status'],
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      start_date: task.start_date ? task.start_date.split('T')[0] : '',
      estimated_hours: task.estimated_hours?.toString() ?? '',
      team_id: task.team_id ?? '',
      dept_id: task.dept_id ?? '',
    } : {
      priority: 'medium',
      status: (defaultStatus as FormData['status']) ?? 'todo',
    },
  })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    try {
      const payload = {
        ...data,
        description: description || null,
        org_id: orgId,
        created_by: currentUserId,
        due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
        start_date: data.start_date ? new Date(data.start_date).toISOString() : null,
        estimated_hours: data.estimated_hours ? parseFloat(data.estimated_hours) : null,
        team_id: data.team_id || null,
        dept_id: data.dept_id || null,
        tags,
      }

      let taskId = task?.id
      if (task?.id) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', task.id)
        if (error) throw error

        // Sync CC watchers
        await supabase.from('task_watchers').delete().eq('task_id', task.id)
        if (selectedCC.length > 0) {
          await supabase.from('task_watchers').insert(
            selectedCC.map(u => ({ task_id: task.id, user_id: u.id, added_by: currentUserId }))
          )
        }

        toast.success('Task updated')
      } else {
        const { data: created, error } = await supabase.from('tasks').insert(payload).select('id').single()
        if (error) throw error
        taskId = (created as { id: string }).id

        // Assign members
        const assigneeRows = selectedAssignees.length > 0
          ? selectedAssignees.map(u => ({ task_id: taskId, user_id: u.id, assigned_by: currentUserId }))
          : [{ task_id: taskId, user_id: currentUserId, assigned_by: currentUserId }]
        const { error: assignError } = await supabase.from('task_assignees').insert(assigneeRows)
        if (assignError) throw assignError

        // Add CC watchers
        if (selectedCC.length > 0) {
          await supabase.from('task_watchers').insert(
            selectedCC.map(u => ({ task_id: taskId, user_id: u.id, added_by: currentUserId }))
          )
        }

        // Send email to assigned users (fire-and-forget)
        const assignedUserIds = assigneeRows.map(r => r.user_id).filter(id => id !== currentUserId)
        if (assignedUserIds.length > 0) {
          const creatorProfile = users.find(u => u.id === currentUserId)
          fetch('/api/notifications/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'task_assigned',
              taskId,
              userIds: assignedUserIds,
              actorName: creatorProfile?.full_name ?? 'Someone',
            }),
          }).catch(() => {})
        }

        toast.success('Task created')
        onCreated?.(taskId!)
      }

      setOpen(false)
      reset()
      setSelectedAssignees([])
      setSelectedCC([])
      setTags([])
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

  const filteredCCUsers = users.filter(
    u => !selectedCC.find(c => c.id === u.id) &&
      !selectedAssignees.find(a => a.id === u.id) &&
      (u.full_name.toLowerCase().includes(ccSearch.toLowerCase()) ||
       u.email.toLowerCase().includes(ccSearch.toLowerCase()))
  )

  const watchedTeamId = watch('team_id')
  const selectedTeam = teams.find(t => t.id === watchedTeamId)
  const teamMemberUsers: OrgUser[] = (selectedTeam?.team_members ?? [])
    .map(m => m.profiles)
    .filter((p): p is OrgUser => !!p)

  function addAllTeamMembers() {
    const toAdd = teamMemberUsers.filter(u => !selectedAssignees.find(a => a.id === u.id))
    if (toAdd.length > 0) setSelectedAssignees(prev => [...prev, ...toAdd])
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> New Task</Button>}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <Dialog.Title className="text-lg font-semibold">
              {task ? 'Edit Task' : 'Create New Task'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto flex-1 p-6">
            <form id="task-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <Input placeholder="What needs to be done?" error={errors.title?.message} {...register('title')} autoFocus />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <RichTextEditor
                  key={open ? 'open' : 'closed'}
                  value={description}
                  onChange={setDescription}
                  placeholder="Add details, checklist items, or formatted notes..."
                />
              </div>

              {/* Priority / Status / Team */}
              <div className="grid grid-cols-3 gap-4">
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
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                  <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('team_id')}>
                    <option value="">— None —</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {!task && watchedTeamId && teamMemberUsers.length > 0 && (
                    <button
                      type="button"
                      onClick={addAllTeamMembers}
                      className="mt-1.5 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <Users className="h-3 w-3" />
                      Add all {teamMemberUsers.length} team member{teamMemberUsers.length !== 1 ? 's' : ''} as assignees
                    </button>
                  )}
                </div>
              </div>

              {/* Dates / Hours */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <Input type="date" {...register('start_date')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <Input type="date" {...register('due_date')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Est. Hours</label>
                  <Input type="number" step="0.5" min="0" placeholder="0" {...register('estimated_hours')} />
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

              {/* Assignees — create only */}
              {!task && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assignees (PIC)</label>
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
                    placeholder="Search team members..."
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
              )}

              {/* CC — always editable */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-gray-400" />
                  CC <span className="font-normal text-gray-400">(spectators — can track but are not responsible)</span>
                </label>
                {selectedCC.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedCC.map(u => (
                      <div key={u.id} className="flex items-center gap-1.5 bg-amber-50 rounded-full pl-1 pr-2 py-0.5">
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-5 h-5 text-xs" />
                        <span className="text-xs font-medium text-amber-700">{u.full_name.split(' ')[0]}</span>
                        <button type="button" onClick={() => setSelectedCC(selectedCC.filter(c => c.id !== u.id))} className="text-amber-300 hover:text-red-500 text-xs">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  placeholder="Add people to CC..."
                  value={ccSearch}
                  onChange={e => setCcSearch(e.target.value)}
                />
                {ccSearch && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                    {filteredCCUsers.slice(0, 8).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setSelectedCC([...selectedCC, u]); setCcSearch('') }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      >
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6 text-xs" />
                        <span>{u.full_name}</span>
                        <span className="text-gray-400 text-xs ml-auto">{u.email}</span>
                      </button>
                    ))}
                    {filteredCCUsers.length === 0 && (
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
            <Button type="submit" form="task-form" loading={isSubmitting}>
              {task ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
