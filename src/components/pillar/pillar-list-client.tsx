'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Award, Store, Calendar, Building2, Trash2, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { PillarGamificationBanner } from './pillar-gamification-banner'

type KeyResult = {
  id: string
  title: string
  metric_type: string
  start_value: number
  target_value: number
  current_value: number
  status: string
}

export type PillarAssignment = {
  id: string
  title: string
  description: string | null
  month: string
  status: string
  progress: number
  scope_type: string
  outlet_id: string | null
  assigned_to: string | null
  area_manager_id?: string | null
  created_at: string
  outlets: { name: string; code: string | null } | null
  profiles: { full_name: string; avatar_url: string | null } | null
  area_manager: { id: string; full_name: string } | null
  departments: { name: string } | null
  pillar_assignment_krs: KeyResult[]
}

interface Props {
  initialAssignments: PillarAssignment[]
  initialMonth: string
  rewardOutletIds: string[]
  canDelete?: boolean
  isElevated?: boolean
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  at_risk: 'At Risk',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_VARIANT: Record<string, 'secondary' | 'destructive' | 'default'> = {
  not_started: 'secondary',
  in_progress: 'default',
  at_risk: 'destructive',
  completed: 'default',
  cancelled: 'secondary',
}

function getProgressColor(pct: number) {
  if (pct >= 100) return 'bg-green-500'
  if (pct >= 70) return 'bg-blue-500'
  if (pct >= 40) return 'bg-amber-500'
  return 'bg-red-400'
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={cn('h-2 rounded-full transition-all', getProgressColor(pct))} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

function monthOptions() {
  const opts: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = -3; i <= 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const label = d.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
    opts.push({ value, label })
  }
  return opts
}

function parsePillarNumber(title: string): string | null {
  const m = title.match(/pillar\s*(\d+)/i)
  return m ? m[1] : null
}

const SELECT_CLS = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white h-10 appearance-none pr-8'

export function PillarListClient({ initialAssignments, initialMonth, rewardOutletIds, canDelete = false, isElevated = false }: Props) {
  const router = useRouter()
  const [assignments, setAssignments] = useState(initialAssignments)
  useEffect(() => { setAssignments(initialAssignments) }, [initialAssignments])
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState(initialMonth)
  const [amFilter, setAmFilter] = useState('')
  const [pillarFilter, setPillarFilter] = useState('')

  function changeMonth(m: string) {
    setMonth(m)
    router.push(`/pillar?month=${m}`)
  }

  async function deleteAssignment(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this assigned Pillar? This cannot be undone.')) return
    const res = await fetch(`/api/pillar/assignments/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAssignments(prev => prev.filter(a => a.id !== id))
      toast.success('Pillar deleted')
      router.refresh()
    } else {
      toast.error('Failed to delete Pillar')
    }
  }

  // Build unique AM options from the loaded assignments
  const amOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of assignments) {
      if (a.area_manager?.id && a.area_manager?.full_name) {
        map.set(a.area_manager.id, a.area_manager.full_name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [assignments])

  // Build unique pillar numbers present in the data
  const pillarOptions = useMemo(() => {
    const nums = new Set<string>()
    for (const a of assignments) {
      const n = parsePillarNumber(a.title)
      if (n) nums.add(n)
    }
    return Array.from(nums).sort()
  }, [assignments])

  const filtered = useMemo(() => {
    return assignments.filter(a => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matches =
          a.title.toLowerCase().includes(q) ||
          (a.outlets?.name ?? '').toLowerCase().includes(q) ||
          (a.outlets?.code ?? '').toLowerCase().includes(q) ||
          (a.profiles?.full_name ?? '').toLowerCase().includes(q)
        if (!matches) return false
      }
      if (amFilter && a.area_manager?.id !== amFilter) return false
      if (pillarFilter && parsePillarNumber(a.title) !== pillarFilter) return false
      return true
    })
  }, [assignments, search, amFilter, pillarFilter])

  const total = assignments.length
  const completed = assignments.filter(a => a.status === 'completed').length
  const avgProgress = total > 0 ? Math.round(assignments.reduce((s, a) => s + Number(a.progress), 0) / total) : 0

  const activeFilters = [amFilter, pillarFilter].filter(Boolean).length

  return (
    <div className="space-y-5">
      {rewardOutletIds.length > 0 ? (
        <PillarGamificationBanner outletIds={rewardOutletIds} month={month} />
      ) : (
        <div className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Award className="h-8 w-8 opacity-90" />
            <div>
              <p className="text-sm font-medium opacity-90">Monthly Pillar Progress</p>
              <p className="text-2xl font-bold">{avgProgress}% average · {completed}/{total} completed</p>
            </div>
          </div>
        </div>
      )}

      {/* Search + month row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search pillars or outlets…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={month} onChange={e => changeMonth(e.target.value)} className={SELECT_CLS}>
          {monthOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Elevated filters: AM + Pillar number */}
      {isElevated && (amOptions.length > 0 || pillarOptions.length > 0) && (
        <div className="flex flex-wrap gap-2 items-center">
          {amOptions.length > 0 && (
            <div className="relative">
              <select
                value={amFilter}
                onChange={e => setAmFilter(e.target.value)}
                className={cn(SELECT_CLS, amFilter && 'border-orange-400 text-orange-700 bg-orange-50')}
              >
                <option value="">All Area Managers</option>
                {amOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            </div>
          )}
          {pillarOptions.length > 0 && (
            <div className="relative">
              <select
                value={pillarFilter}
                onChange={e => setPillarFilter(e.target.value)}
                className={cn(SELECT_CLS, pillarFilter && 'border-orange-400 text-orange-700 bg-orange-50')}
              >
                <option value="">All Pillars</option>
                {pillarOptions.map(n => <option key={n} value={n}>Pillar {n}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            </div>
          )}
          {activeFilters > 0 && (
            <button
              onClick={() => { setAmFilter(''); setPillarFilter('') }}
              className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {total} shown</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Award className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No Pillars found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(a => {
            const progress = Math.round(Number(a.progress))
            const krCount = a.pillar_assignment_krs?.length ?? 0
            return (
              <Link
                key={a.id}
                href={`/pillar/${a.id}`}
                className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:shadow-md transition-all flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Badge variant={STATUS_VARIANT[a.status] ?? 'secondary'} className="mb-1.5">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </Badge>
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-orange-700 transition-colors line-clamp-2">
                      {a.title}
                    </h3>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={e => deleteAssignment(e, a.id)}
                      className="shrink-0 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete assigned Pillar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Progress</span>
                    <span className="text-sm font-bold text-gray-700">{progress}%</span>
                  </div>
                  <ProgressBar pct={progress} />
                </div>

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100 text-xs text-gray-500">
                  <div className="flex items-center gap-3 flex-wrap">
                    {krCount > 0 && <span>{krCount} Key Result{krCount !== 1 ? 's' : ''}</span>}
                    {a.outlets?.name && (
                      <span className="flex items-center gap-1"><Store className="h-3.5 w-3.5" />{a.outlets.name}</span>
                    )}
                    {a.departments?.name && (
                      <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{a.departments.name}</span>
                    )}
                  </div>
                  <span className="flex items-center gap-1 shrink-0">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(a.month + 'T00:00:00').toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
