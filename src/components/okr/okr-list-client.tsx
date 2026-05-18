'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Target, Calendar, Users, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/avatar'
import { OkrForm, OKR_STATUS_VARIANT, OKR_STATUS_LABEL, getProgressColor, krProgressPct } from './okr-form'
import { formatDate, cn } from '@/lib/utils'

type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
type Department = { id: string; name: string }
type Team = { id: string; name: string }

type KeyResult = {
  id: string
  title: string
  metric_type: string
  start_value: number
  target_value: number
  current_value: number
  unit: string | null
  status: string
  due_date: string | null
}

type Assignee = { user_id: string; role: string }
type Watcher = { user_id: string }

type Objective = {
  id: string
  title: string
  description: string | null
  period_type: string
  period_label: string | null
  start_date: string | null
  end_date: string | null
  status: string
  progress: number
  created_by: string
  created_at: string
  dept_id: string | null
  team_id: string | null
  departments: { name: string } | null
  teams: { name: string } | null
  okr_key_results: KeyResult[]
  okr_assignees: Assignee[]
  okr_watchers: Watcher[]
}

interface Props {
  initialObjectives: Objective[]
  orgId: string
  currentUserId: string
  users: OrgUser[]
  departments: Department[]
  teams: Team[]
}

const STATUSES = ['on_track', 'at_risk', 'behind', 'completed', 'cancelled']
const PERIOD_TYPES = ['monthly', 'quarterly', 'annual']

function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn('w-full bg-gray-100 rounded-full h-2', className)}>
      <div
        className={cn('h-2 rounded-full transition-all', getProgressColor(pct))}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function OkrListClient({ initialObjectives, orgId, currentUserId, users, departments, teams }: Props) {
  const router = useRouter()
  const [objectives, setObjectives] = useState<Objective[]>(initialObjectives)
  useEffect(() => { setObjectives(initialObjectives) }, [initialObjectives])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string[]>([])
  const [filterPeriod, setFilterPeriod] = useState<string[]>([])
  const [scope, setScope] = useState<'all' | 'mine'>('all')

  function toggleStatus(s: string) {
    setFilterStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function togglePeriod(p: string) {
    setFilterPeriod(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  const filtered = useMemo(() => {
    let result = objectives
    if (scope === 'mine') {
      result = result.filter(o =>
        o.okr_assignees.some(a => a.user_id === currentUserId) ||
        o.okr_watchers.some(w => w.user_id === currentUserId) ||
        o.created_by === currentUserId
      )
    }
    if (filterStatus.length > 0) {
      result = result.filter(o => filterStatus.includes(o.status))
    }
    if (filterPeriod.length > 0) {
      result = result.filter(o => filterPeriod.includes(o.period_type))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(o =>
        o.title.toLowerCase().includes(q) ||
        (o.description ?? '').toLowerCase().includes(q) ||
        (o.period_label ?? '').toLowerCase().includes(q)
      )
    }
    return result
  }, [objectives, search, filterStatus, filterPeriod, scope, currentUserId])

  // Stats
  const total = objectives.length
  const onTrack = objectives.filter(o => o.status === 'on_track').length
  const atRisk = objectives.filter(o => o.status === 'at_risk').length
  const behind = objectives.filter(o => o.status === 'behind').length
  const completed = objectives.filter(o => o.status === 'completed').length
  const avgProgress = total > 0 ? Math.round(objectives.reduce((s, o) => s + Number(o.progress), 0) / total) : 0

  return (
    <div className="space-y-5">
      {/* Summary Stats */}
      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: total, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
            { label: 'On Track', value: onTrack, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
            { label: 'At Risk', value: atRisk, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
            { label: 'Behind', value: behind, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
            { label: 'Avg Progress', value: `${avgProgress}%`, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.bg, s.border)}>
              <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search objectives..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            {(['all', 'mine'] as const).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={cn(
                  'px-3 py-1.5 transition-colors capitalize',
                  scope === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                {s === 'all' ? 'All OKRs' : 'My OKRs'}
              </button>
            ))}
          </div>

          {/* Status filters */}
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  filterStatus.includes(s)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                )}
              >
                {OKR_STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          {/* Period filters */}
          <div className="flex gap-1">
            {PERIOD_TYPES.map(p => (
              <button
                key={p}
                onClick={() => togglePeriod(p)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors capitalize',
                  filterPeriod.includes(p)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Objectives Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No objectives found</p>
          <p className="text-sm mt-1">
            {total === 0 ? 'Create your first objective to get started.' : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(obj => {
            const assigneeUsers = users.filter(u => obj.okr_assignees.some(a => a.user_id === u.id))
            const progress = Math.round(Number(obj.progress))
            const krCount = obj.okr_key_results?.length ?? 0
            const completedKrs = obj.okr_key_results?.filter(kr => {
              const p = krProgressPct(kr)
              return p >= 100
            }).length ?? 0

            return (
              <Link
                key={obj.id}
                href={`/okr/${obj.id}`}
                className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col gap-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant={OKR_STATUS_VARIANT[obj.status] ?? 'secondary'} className="shrink-0">
                        {OKR_STATUS_LABEL[obj.status] ?? obj.status}
                      </Badge>
                      {obj.period_label && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize shrink-0">
                          {obj.period_label}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-indigo-700 transition-colors line-clamp-2">
                      {obj.title}
                    </h3>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Overall Progress</span>
                    <span className={cn(
                      'text-sm font-bold',
                      progress >= 70 ? 'text-green-600' : progress >= 40 ? 'text-amber-600' : 'text-red-600'
                    )}>
                      {progress}%
                    </span>
                  </div>
                  <ProgressBar pct={progress} />
                </div>

                {/* Key Results */}
                {krCount > 0 && (
                  <div className="space-y-1.5">
                    {obj.okr_key_results.slice(0, 3).map(kr => {
                      const krPct = Math.round(krProgressPct(kr))
                      return (
                        <div key={kr.id} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-600 truncate">{kr.title}</div>
                            <div className="w-full bg-gray-100 rounded-full h-1 mt-0.5">
                              <div
                                className={cn('h-1 rounded-full', getProgressColor(krPct))}
                                style={{ width: `${krPct}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 shrink-0 w-8 text-right">{krPct}%</span>
                        </div>
                      )
                    })}
                    {krCount > 3 && (
                      <p className="text-xs text-gray-400">+{krCount - 3} more key results</p>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {krCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Target className="h-3.5 w-3.5" />
                        {completedKrs}/{krCount} KRs
                      </span>
                    )}
                    {obj.departments?.name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {obj.departments.name}
                      </span>
                    )}
                    {obj.end_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(obj.end_date)}
                      </span>
                    )}
                  </div>

                  {/* Assignee avatars */}
                  {assigneeUsers.length > 0 && (
                    <div className="flex items-center">
                      {assigneeUsers.slice(0, 4).map((u, i) => (
                        <div key={u.id} style={{ marginLeft: i > 0 ? '-6px' : '0' }} className="relative">
                          <UserAvatar
                            name={u.full_name}
                            avatarUrl={u.avatar_url}
                            size="sm"
                            className="w-6 h-6 text-xs ring-2 ring-white"
                          />
                        </div>
                      ))}
                      {assigneeUsers.length > 4 && (
                        <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-medium text-gray-600 -ml-1.5">
                          +{assigneeUsers.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
