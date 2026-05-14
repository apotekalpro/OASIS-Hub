'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TaskCardData } from './task-card'
import { TaskList } from './task-list'
import { KanbanBoard } from './kanban-board'
import { TaskForm } from './task-form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LayoutList, Columns3, Search, Filter, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type View = 'list' | 'kanban'
type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
type Team = { id: string; name: string }
type Department = { id: string; name: string }

const STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'cancelled']
const PRIORITIES = ['urgent', 'high', 'medium', 'low']
const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done', cancelled: 'Cancelled',
}

interface Props {
  initialTasks: TaskCardData[]
  orgId: string
  currentUserId: string
  currentUserRole: string
  users: OrgUser[]
  teams: Team[]
  departments: Department[]
}

export function TasksClient({ initialTasks, orgId, currentUserId, currentUserRole, users, teams, departments }: Props) {
  const router = useRouter()
  const [view, setView] = useState<View>('list')
  const [tasks, setTasks] = useState<TaskCardData[]>(initialTasks)
  useEffect(() => { setTasks(initialTasks) }, [initialTasks])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string[]>(['todo', 'in_progress', 'in_review'])
  const [filterPriority, setFilterPriority] = useState<string[]>([])

  // Default active view: excludes done/cancelled
  const DEFAULT_STATUS_FILTER = ['todo', 'in_progress', 'in_review']
  const isDefaultFilter = filterStatus.length === DEFAULT_STATUS_FILTER.length &&
    DEFAULT_STATUS_FILTER.every(s => filterStatus.includes(s))

  function handleStatBadgeClick(status: string) {
    // If already filtered to exactly this status, reset to default view
    if (filterStatus.length === 1 && filterStatus[0] === status) {
      setFilterStatus(DEFAULT_STATUS_FILTER)
    } else {
      setFilterStatus([status])
    }
  }
  const [showFilters, setShowFilters] = useState(false)
  const [scope, setScope] = useState<'all' | 'mine'>('all')

  function refresh() { router.refresh() }

  async function handleTaskCreated(taskId: string) {
    const supabase = createClient()
    type RawAssignee = { user_id: string; profiles?: { id: string; full_name: string; avatar_url: string | null } | null }
    type RawTask = {
      id: string; title: string; description: string | null; status: string; priority: string
      due_date: string | null; tags: string[]; created_at: string
      task_assignees?: RawAssignee[]
    }
    const { data } = await supabase
      .from('tasks')
      .select('id, title, description, status, priority, due_date, tags, created_at, task_assignees(user_id, profiles(id, full_name, avatar_url))')
      .eq('id', taskId)
      .single()
    if (data) {
      const raw = data as unknown as RawTask
      const newTask: TaskCardData = {
        id: raw.id,
        title: raw.title,
        description: raw.description,
        status: raw.status,
        priority: raw.priority,
        due_date: raw.due_date,
        tags: raw.tags ?? [],
        created_at: raw.created_at,
        assignees: (raw.task_assignees ?? [])
          .map(a => a.profiles ? { id: a.profiles.id, full_name: a.profiles.full_name, avatar_url: a.profiles.avatar_url } : null)
          .filter(Boolean) as Array<{ id: string; full_name: string; avatar_url: string | null }>,
      }
      setTasks(prev => [newTask, ...prev])
    }
    router.refresh()
  }

  const filtered = useMemo(() => {
    let result = tasks
    if (scope === 'mine') {
      result = result.filter(t =>
        t.assignees?.some(a => a.id === currentUserId) ||
        t.created_by === currentUserId
      )
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.includes(q))
      )
    }
    if (filterStatus.length > 0) result = result.filter(t => filterStatus.includes(t.status))
    if (filterPriority.length > 0) result = result.filter(t => filterPriority.includes(t.priority))
    return result
  }, [tasks, search, filterStatus, filterPriority, scope, currentUserId])

  const activeFilters = (isDefaultFilter ? 0 : filterStatus.length) + filterPriority.length
  const counts = useMemo(() => ({
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  }), [tasks])

  function toggleStatus(s: string) {
    setFilterStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  function togglePriority(p: string) {
    setFilterPriority(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <div className="flex items-center gap-1 mt-1 text-sm">
            <button
              onClick={() => handleStatBadgeClick('todo')}
              className={cn(
                'px-2 py-0.5 rounded-md font-medium transition-colors',
                filterStatus.length === 1 && filterStatus[0] === 'todo'
                  ? 'bg-gray-200 text-gray-900'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              )}
            >{counts.todo} to do</button>
            <span className="text-gray-300">·</span>
            <button
              onClick={() => handleStatBadgeClick('in_progress')}
              className={cn(
                'px-2 py-0.5 rounded-md font-medium transition-colors',
                filterStatus.length === 1 && filterStatus[0] === 'in_progress'
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-blue-600 hover:bg-blue-50'
              )}
            >{counts.in_progress} in progress</button>
            <span className="text-gray-300">·</span>
            <button
              onClick={() => handleStatBadgeClick('done')}
              className={cn(
                'px-2 py-0.5 rounded-md font-medium transition-colors',
                filterStatus.length === 1 && filterStatus[0] === 'done'
                  ? 'bg-green-100 text-green-800'
                  : 'text-green-600 hover:bg-green-50'
              )}
            >{counts.done} done</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button
              onClick={() => setScope('all')}
              className={cn('px-3 py-1.5 font-medium transition-colors', scope === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
            >All Tasks</button>
            <button
              onClick={() => setScope('mine')}
              className={cn('px-3 py-1.5 font-medium transition-colors', scope === 'mine' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
            >My Tasks</button>
          </div>
          <TaskForm
          orgId={orgId}
          currentUserId={currentUserId}
          users={users}
          teams={teams}
          departments={departments}
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          }
          onCreated={handleTaskCreated}
        />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(v => !v)}
          className={cn(activeFilters > 0 && 'border-indigo-400 text-indigo-600 bg-indigo-50')}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilters > 0 && (
            <span className="ml-1 bg-indigo-600 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs">
              {activeFilters}
            </span>
          )}
        </Button>

        {activeFilters > 0 && (
          <button
            onClick={() => { setFilterStatus(DEFAULT_STATUS_FILTER); setFilterPriority([]) }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('list')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all', view === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            <LayoutList className="h-4 w-4" /> List
          </button>
          <button
            onClick={() => setView('kanban')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all', view === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            <Columns3 className="h-4 w-4" /> Board
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium border transition-all',
                    filterStatus.includes(s)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-300 text-gray-600 hover:border-indigo-400'
                  )}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Priority</p>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  onClick={() => togglePriority(p)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium border capitalize transition-all',
                    filterPriority.includes(p)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-300 text-gray-600 hover:border-indigo-400'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View */}
      {view === 'list' ? (
        <TaskList
          tasks={filtered}
          orgId={orgId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole as import('@/types/database').UserRole}
          users={users}
          teams={teams}
          departments={departments}
          onRefresh={refresh}
        />
      ) : (
        <KanbanBoard
          tasks={filtered}
          orgId={orgId}
          currentUserId={currentUserId}
          users={users}
          teams={teams}
          departments={departments}
          onTasksChange={setTasks}
        />
      )}
    </div>
  )
}
