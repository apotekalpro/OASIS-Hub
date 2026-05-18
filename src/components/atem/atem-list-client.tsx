'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AtemForm, type ExistingAtemItem } from './atem-form'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, formatDate } from '@/lib/utils'
import { Search, Filter, X, Edit2, Trash2, Clock, Calendar } from 'lucide-react'
import { toast } from 'sonner'

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
type Department = { id: string; name: string }
type Team = { id: string; name: string }

type AtemItem = {
  id: string
  task: string
  deadline: string | null
  deadline_text: string | null
  action_plan: string | null
  impact: string | null
  dependencies: string | null
  strategic_alignment: string | null
  consequences_of_delay: string | null
  estimated_time: number | null
  status: string
  priority: string
  tags: string[]
  created_at: string
  dept_id: string | null
  team_id: string | null
  created_by: string
  departments?: { name: string } | null
  teams?: { name: string } | null
  atem_assignees?: { user_id: string }[]
  atem_watchers?: { user_id: string }[]
}

interface Props {
  initialItems: AtemItem[]
  orgId: string
  currentUserId: string
  users: OrgUser[]
  departments: Department[]
  teams: Team[]
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline'> = {
  pending: 'secondary',
  in_progress: 'default',
  completed: 'success',
  blocked: 'destructive',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-blue-400',
  low: 'bg-gray-300',
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const STATUSES = ['pending', 'in_progress', 'completed', 'blocked']
const PRIORITIES = ['urgent', 'high', 'medium', 'low']

export function AtemListClient({ initialItems, orgId, currentUserId, users, departments, teams }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<AtemItem[]>(initialItems)
  useEffect(() => { setItems(initialItems) }, [initialItems])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string[]>([])
  const [filterPriority, setFilterPriority] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let result = items
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(item =>
        stripHtml(item.task).toLowerCase().includes(q) ||
        item.impact?.toLowerCase().includes(q) ||
        item.tags?.some(t => t.includes(q))
      )
    }
    if (filterStatus.length > 0) result = result.filter(item => filterStatus.includes(item.status))
    if (filterPriority.length > 0) result = result.filter(item => filterPriority.includes(item.priority))
    return result
  }, [items, search, filterStatus, filterPriority])

  const activeFilters = filterStatus.length + filterPriority.length

  function toggleStatus(s: string) {
    setFilterStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  function togglePriority(p: string) {
    setFilterPriority(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this ATEM item? This cannot be undone.')) return
    setDeletingId(id)
    const res = await fetch(`/api/atem/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to delete item')
    } else {
      setItems(prev => prev.filter(item => item.id !== id))
      toast.success('ATEM item deleted')
    }
    setDeletingId(null)
  }

  function getAssigneeUsers(item: AtemItem): OrgUser[] {
    const ids = (item.atem_assignees ?? []).map(a => a.user_id)
    return users.filter(u => ids.includes(u.id))
  }

  const counts = useMemo(() => ({
    pending: items.filter(i => i.status === 'pending').length,
    in_progress: items.filter(i => i.status === 'in_progress').length,
    completed: items.filter(i => i.status === 'completed').length,
    blocked: items.filter(i => i.status === 'blocked').length,
  }), [items])

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <button
          onClick={() => setFilterStatus(prev => prev.length === 1 && prev[0] === 'pending' ? [] : ['pending'])}
          className={cn('px-2 py-0.5 rounded-md font-medium transition-colors', filterStatus.length === 1 && filterStatus[0] === 'pending' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100')}
        >{counts.pending} pending</button>
        <span className="text-gray-300">·</span>
        <button
          onClick={() => setFilterStatus(prev => prev.length === 1 && prev[0] === 'in_progress' ? [] : ['in_progress'])}
          className={cn('px-2 py-0.5 rounded-md font-medium transition-colors', filterStatus.length === 1 && filterStatus[0] === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'text-blue-600 hover:bg-blue-50')}
        >{counts.in_progress} in progress</button>
        <span className="text-gray-300">·</span>
        <button
          onClick={() => setFilterStatus(prev => prev.length === 1 && prev[0] === 'completed' ? [] : ['completed'])}
          className={cn('px-2 py-0.5 rounded-md font-medium transition-colors', filterStatus.length === 1 && filterStatus[0] === 'completed' ? 'bg-green-100 text-green-800' : 'text-green-600 hover:bg-green-50')}
        >{counts.completed} completed</button>
        <span className="text-gray-300">·</span>
        <button
          onClick={() => setFilterStatus(prev => prev.length === 1 && prev[0] === 'blocked' ? [] : ['blocked'])}
          className={cn('px-2 py-0.5 rounded-md font-medium transition-colors', filterStatus.length === 1 && filterStatus[0] === 'blocked' ? 'bg-red-100 text-red-800' : 'text-red-600 hover:bg-red-50')}
        >{counts.blocked} blocked</button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search ATEM items..."
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
            <span className="ml-1 bg-indigo-600 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs">{activeFilters}</span>
          )}
        </Button>
        {activeFilters > 0 && (
          <button
            onClick={() => { setFilterStatus([]); setFilterPriority([]) }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
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
                  {STATUS_LABEL[s]}
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
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
            <span className="text-xl font-bold text-indigo-400">A</span>
          </div>
          <p className="text-gray-500 font-medium">No ATEM items found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search || activeFilters > 0 ? 'Try adjusting your search or filters' : 'Create your first ATEM item to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const assigneeUsers = getAssigneeUsers(item)
            const shown = assigneeUsers.slice(0, 4)
            const extra = assigneeUsers.length - shown.length
            const itemAsExisting: ExistingAtemItem = {
              id: item.id,
              task: item.task,
              priority: item.priority,
              status: item.status,
              deadline: item.deadline,
              deadline_text: item.deadline_text ?? null,
              action_plan: item.action_plan ?? null,
              impact: item.impact,
              dependencies: item.dependencies,
              strategic_alignment: item.strategic_alignment,
              consequences_of_delay: item.consequences_of_delay,
              estimated_time: item.estimated_time,
              dept_id: item.dept_id,
              team_id: item.team_id,
              tags: item.tags,
            }

            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-sm transition-all group">
                {/* Priority stripe */}
                <div className={cn('h-1 rounded-t-xl', {
                  'bg-red-500': item.priority === 'urgent',
                  'bg-orange-400': item.priority === 'high',
                  'bg-blue-400': item.priority === 'medium',
                  'bg-gray-200': item.priority === 'low',
                })} />

                <div className="p-4">
                  {/* Row 1: Task title + actions */}
                  <div className="flex items-start gap-3">
                    <span className={cn('mt-1.5 h-2.5 w-2.5 rounded-full shrink-0', PRIORITY_DOT[item.priority])} />
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/atem/${item.id}`}
                        className="text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors line-clamp-2 leading-snug"
                      >
                        {stripHtml(item.task)}
                      </Link>

                      {/* Row 2: badges row */}
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <Badge variant={STATUS_VARIANT[item.status] ?? 'secondary'} className="text-xs">
                          {STATUS_LABEL[item.status] ?? item.status}
                        </Badge>
                        <span className={cn('text-xs font-medium capitalize', {
                          'text-red-600': item.priority === 'urgent',
                          'text-orange-500': item.priority === 'high',
                          'text-blue-600': item.priority === 'medium',
                          'text-gray-400': item.priority === 'low',
                        })}>
                          {PRIORITY_LABEL[item.priority]}
                        </span>
                        {item.departments?.name && (
                          <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">
                            {item.departments.name}
                          </span>
                        )}
                        {item.teams?.name && (
                          <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">
                            {item.teams.name}
                          </span>
                        )}
                        {item.tags?.slice(0, 2).map(tag => (
                          <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-1.5 py-0.5">{tag}</span>
                        ))}
                        {(item.tags?.length ?? 0) > 2 && (
                          <span className="text-xs text-gray-400">+{item.tags.length - 2}</span>
                        )}
                      </div>

                      {/* Row 3: meta info row */}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {item.deadline && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-medium">Nearest:</span>
                            {formatDate(item.deadline)}
                          </span>
                        )}
                        {item.estimated_time && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            {item.estimated_time} day{item.estimated_time !== 1 ? 's' : ''}
                          </span>
                        )}
                        {item.impact && (
                          <span className="text-xs text-gray-400 line-clamp-1 max-w-[240px]">
                            <span className="font-medium text-green-700">Impact:</span> {stripHtml(item.impact)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: assignees + actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Assignees */}
                      <div className="flex items-center">
                        {shown.map((u, i) => (
                          <div key={u.id} style={{ marginLeft: i > 0 ? '-6px' : 0 }} className="relative" title={u.full_name}>
                            <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-7 h-7 text-xs border-2 border-white" />
                          </div>
                        ))}
                        {extra > 0 && (
                          <div style={{ marginLeft: '-6px' }} className="relative w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600">+{extra}</span>
                          </div>
                        )}
                      </div>

                      {/* Edit/Delete — visible on hover */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <AtemForm
                          orgId={orgId}
                          currentUserId={currentUserId}
                          users={users}
                          departments={departments}
                          teams={teams}
                          item={itemAsExisting}
                          trigger={
                            <button className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors" title="Edit">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          }
                          onCreated={() => router.refresh()}
                        />
                        <button
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
