'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TaskCardData, PRIORITY_DOT, STATUS_LABEL, STATUS_VARIANT } from './task-card'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { TaskForm } from './task-form'
import { Calendar, ChevronUp, ChevronDown, ChevronsUpDown, CheckCircle2, X } from 'lucide-react'
import { getDueStatus, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
type Team = { id: string; name: string }
type Department = { id: string; name: string }
type SortKey = 'title' | 'priority' | 'status' | 'due_date' | 'created_at'
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 }
const DUE_BADGE_CLS = {
  red: 'text-red-600 bg-red-50 border-red-200',
  orange: 'text-orange-600 bg-orange-50 border-orange-200',
  yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  gray: 'text-gray-500 bg-transparent border-transparent',
}

interface Props {
  tasks: TaskCardData[]
  orgId: string
  currentUserId: string
  users: OrgUser[]
  teams: Team[]
  departments: Department[]
  onRefresh: () => void
}

function SortIcon({ field, active, dir }: { field: string; active: string; dir: SortDir }) {
  if (field !== active) return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-300" />
  return dir === 'asc'
    ? <ChevronUp className="h-3.5 w-3.5 text-indigo-500" />
    : <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />
}

export function TaskList({ tasks, orgId, currentUserId, users, teams, departments, onRefresh }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  async function handleComplete(taskId: string) {
    setCompleting(taskId)
    const supabase = createClient()
    const { error } = await supabase.from('tasks').update({ status: 'done' }).eq('id', taskId)
    if (error) toast.error(error.message)
    else { toast.success('Task marked as complete!'); onRefresh() }
    setCompleting(null)
    setConfirmId(null)
  }

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'priority') cmp = (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0)
    else if (sortKey === 'due_date') cmp = (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
    else if (sortKey === 'title') cmp = a.title.localeCompare(b.title)
    else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
    else cmp = a.created_at.localeCompare(b.created_at)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const cols: { key: SortKey; label: string; cls: string }[] = [
    { key: 'title', label: 'Task', cls: 'text-left px-4 py-3 font-medium text-gray-500 w-full' },
    { key: 'priority', label: 'Priority', cls: 'text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap' },
    { key: 'status', label: 'Status', cls: 'text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap' },
    { key: 'due_date', label: 'Due Date', cls: 'text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap' },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {cols.map(c => (
              <th key={c.key} className={c.cls}>
                <button onClick={() => toggleSort(c.key)} className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                  {c.label}<SortIcon field={c.key} active={sortKey} dir={sortDir} />
                </button>
              </th>
            ))}
            <th className="text-left px-4 py-3 font-medium text-gray-500">Assignees</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map(task => {
            const due = getDueStatus(task.due_date)
            const isDone = task.status === 'done' || task.status === 'cancelled'
            const canComplete = !isDone && (
              task.created_by === currentUserId ||
              task.assignees?.some(a => a.id === currentUserId)
            )
            return (
              <tr key={task.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-4 py-3">
                  <Link href={`/tasks/${task.id}`} className="flex items-start gap-2 min-w-0">
                    <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', PRIORITY_DOT[task.priority as keyof typeof PRIORITY_DOT])} />
                    <div className="min-w-0">
                      <p className={cn('font-medium text-gray-900 group-hover:text-indigo-600 transition-colors truncate max-w-xs', isDone && 'line-through text-gray-400')}>
                        {task.title}
                      </p>
                      {task.tags?.length > 0 && (
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {task.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="rounded-full bg-indigo-50 text-indigo-700 px-1.5 py-0 text-xs">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize text-gray-600">{task.priority}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[task.status as keyof typeof STATUS_VARIANT] ?? 'secondary'}>
                    {STATUS_LABEL[task.status as keyof typeof STATUS_LABEL] ?? task.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 min-w-[130px]">
                  {due && !isDone ? (
                    <div className="flex flex-col gap-0.5">
                      <span className={cn('flex items-center gap-1 text-xs font-medium', {
                        'text-red-600': due.color === 'red',
                        'text-orange-600': due.color === 'orange',
                        'text-yellow-700': due.color === 'yellow',
                        'text-gray-500': due.color === 'gray',
                      })}>
                        <Calendar className="h-3 w-3 shrink-0" />{due.label}
                      </span>
                      {due.badge && (
                        <span className={cn('inline-flex w-fit text-[10px] font-bold px-1.5 py-0.5 rounded border', DUE_BADGE_CLS[due.color])}>
                          {due.badge}
                        </span>
                      )}
                    </div>
                  ) : task.due_date ? (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {task.assignees && task.assignees.length > 0 ? (
                    <div className="flex -space-x-1.5">
                      {task.assignees.slice(0, 3).map(a => (
                        <UserAvatar key={a.id} name={a.full_name} avatarUrl={a.avatar_url} size="sm" className="w-6 h-6 text-xs ring-2 ring-white" />
                      ))}
                      {task.assignees.length > 3 && (
                        <div className="h-6 w-6 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center text-xs font-medium text-gray-600">
                          +{task.assignees.length - 3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {canComplete && (
                      confirmId === task.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleComplete(task.id)}
                            disabled={completing === task.id}
                            className="flex items-center gap-1 text-xs bg-green-600 text-white px-2 py-1 rounded-md hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {completing === task.id ? 'Saving…' : 'Confirm'}
                          </button>
                          <button onClick={() => setConfirmId(null)} className="text-gray-400 hover:text-gray-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(task.id)}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />Complete
                        </button>
                      )
                    )}
                    <TaskForm
                      orgId={orgId}
                      currentUserId={currentUserId}
                      users={users}
                      teams={teams}
                      departments={departments}
                      task={{
                        id: task.id, title: task.title, description: task.description,
                        priority: task.priority, status: task.status, due_date: task.due_date,
                        start_date: null, estimated_hours: null, team_id: null, dept_id: null, tags: task.tags,
                      }}
                      trigger={
                        <button className="text-xs text-gray-500 hover:text-indigo-600 transition-colors">
                          Edit
                        </button>
                      }
                      onCreated={onRefresh}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {tasks.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No tasks found</p>
        </div>
      )}
    </div>
  )
}
