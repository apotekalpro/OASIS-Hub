'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Award, ChevronDown, TrendingUp, Store, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type KR = {
  id: string
  current_value: number
  target_value: number
  start_value: number
  metric_type: string
}

type Assignment = {
  id: string
  title: string
  progress: number
  status: string
  outlet_id: string | null
  outlets: { id: string; name: string; code: string | null } | null
  area_manager: { id: string; full_name: string } | null
  pillar_assignment_krs: KR[]
}

interface Props {
  initialAssignments: Assignment[]
  initialMonth: string
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

function krProgress(kr: KR): number {
  if (kr.metric_type === 'boolean') return kr.current_value >= 1 ? 100 : 0
  const range = kr.target_value - kr.start_value
  if (range === 0) return 0
  return Math.min(100, Math.max(0, ((kr.current_value - kr.start_value) / range) * 100))
}

function avgKrProgress(krs: KR[]): number {
  if (krs.length === 0) return 0
  return Math.round(krs.reduce((s, kr) => s + krProgress(kr), 0) / krs.length)
}

function getProgressColor(pct: number) {
  if (pct >= 100) return 'bg-green-500'
  if (pct >= 70) return 'bg-blue-500'
  if (pct >= 40) return 'bg-amber-500'
  return 'bg-red-400'
}

function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn('w-full bg-gray-100 rounded-full h-2', className)}>
      <div className={cn('h-2 rounded-full transition-all', getProgressColor(pct))} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

const SELECT_CLS = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white h-10 appearance-none pr-8'

export function PillarDashboardClient({ initialAssignments, initialMonth }: Props) {
  const router = useRouter()
  const [month, setMonth] = useState(initialMonth)
  const [search, setSearch] = useState('')
  const [amFilter, setAmFilter] = useState('')
  const [pillarFilter, setPillarFilter] = useState('')

  function changeMonth(m: string) {
    setMonth(m)
    router.push(`/admin/pillar-dashboard?month=${m}`)
  }

  // Nationwide summary
  const nationwide = useMemo(() => {
    const total = initialAssignments.length
    if (total === 0) return { avg: 0, completed: 0, total: 0 }
    const avg = Math.round(initialAssignments.reduce((s, a) => s + avgKrProgress(a.pillar_assignment_krs), 0) / total)
    const completed = initialAssignments.filter(a => avgKrProgress(a.pillar_assignment_krs) >= 100).length
    return { avg, completed, total }
  }, [initialAssignments])

  // Area manager breakdown
  const amBreakdown = useMemo(() => {
    const map = new Map<string, { id: string; name: string; assignments: Assignment[] }>()
    for (const a of initialAssignments) {
      if (a.area_manager?.id) {
        if (!map.has(a.area_manager.id)) {
          map.set(a.area_manager.id, { id: a.area_manager.id, name: a.area_manager.full_name, assignments: [] })
        }
        map.get(a.area_manager.id)!.assignments.push(a)
      }
    }
    return Array.from(map.values())
      .map(am => {
        const pillarMap = new Map<string, number[]>()
        for (const a of am.assignments) {
          const n = parsePillarNumber(a.title)
          if (n) {
            if (!pillarMap.has(n)) pillarMap.set(n, [])
            pillarMap.get(n)!.push(avgKrProgress(a.pillar_assignment_krs))
          }
        }
        const pillarAvgs = new Map(
          Array.from(pillarMap.entries()).map(([n, vals]) => [n, Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)])
        )
        const avg = am.assignments.length > 0
          ? Math.round(am.assignments.reduce((s, a) => s + avgKrProgress(a.pillar_assignment_krs), 0) / am.assignments.length)
          : 0
        return { ...am, avg, count: am.assignments.length, pillarAvgs }
      })
      .sort((a, b) => b.avg - a.avg)
  }, [initialAssignments])

  // Unique area manager options for filter
  const amOptions = useMemo(() => {
    return amBreakdown.map(am => ({ id: am.id, name: am.name }))
  }, [amBreakdown])

  // Pillar options
  const pillarOptions = useMemo(() => {
    const nums = new Set<string>()
    for (const a of initialAssignments) {
      const n = parsePillarNumber(a.title)
      if (n) nums.add(n)
    }
    return Array.from(nums).sort()
  }, [initialAssignments])

  // Filtered assignments for outlet table
  const filtered = useMemo(() => {
    return initialAssignments.filter(a => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matches =
          a.title.toLowerCase().includes(q) ||
          (a.outlets?.name ?? '').toLowerCase().includes(q) ||
          (a.outlets?.code ?? '').toLowerCase().includes(q) ||
          (a.area_manager?.full_name ?? '').toLowerCase().includes(q)
        if (!matches) return false
      }
      if (amFilter && a.area_manager?.id !== amFilter) return false
      if (pillarFilter && parsePillarNumber(a.title) !== pillarFilter) return false
      return true
    })
  }, [initialAssignments, search, amFilter, pillarFilter])

  // Group filtered by outlet
  const outletRows = useMemo(() => {
    const map = new Map<string, { outletId: string; outletName: string; outletCode: string | null; amName: string; pillars: { title: string; progress: number }[] }>()
    for (const a of filtered) {
      const key = a.outlet_id ?? a.id
      if (!map.has(key)) {
        map.set(key, {
          outletId: key,
          outletName: a.outlets?.name ?? '—',
          outletCode: a.outlets?.code ?? null,
          amName: a.area_manager?.full_name ?? '—',
          pillars: [],
        })
      }
      map.get(key)!.pillars.push({ title: a.title, progress: avgKrProgress(a.pillar_assignment_krs) })
    }
    return Array.from(map.values()).sort((a, b) => a.outletName.localeCompare(b.outletName))
  }, [filtered])

  const activeFilters = [amFilter, pillarFilter].filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Nationwide summary */}
      <div className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Award className="h-8 w-8 opacity-90" />
          <div>
            <p className="text-sm font-medium opacity-90">Nationwide Pillar Progress</p>
            <p className="text-2xl font-bold">{nationwide.avg}% average · {nationwide.completed}/{nationwide.total} completed</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => changeMonth(e.target.value)} className="border border-white/30 rounded-lg px-3 py-2 text-sm bg-white/20 text-white appearance-none h-10">
            {monthOptions().map(o => <option key={o.value} value={o.value} className="text-gray-900">{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Area Manager Breakdown */}
      {amBreakdown.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Users className="h-4 w-4" />Area Manager Progress</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {amBreakdown.map(am => (
              <div key={am.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-gray-900 text-sm truncate">{am.name}</p>
                  <span className="text-sm font-bold text-gray-700 shrink-0 ml-2">{am.avg}%</span>
                </div>
                <ProgressBar pct={am.avg} />
                <div className="mt-3 space-y-1.5">
                  {pillarOptions.map(n => {
                    const pct = am.pillarAvgs.get(n)
                    if (pct === undefined) return null
                    return (
                      <div key={n} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-14 shrink-0">Pillar {n}</span>
                        <ProgressBar pct={pct} className="flex-1" />
                        <span className="text-xs font-semibold text-gray-600 w-8 text-right shrink-0">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2">{am.count} assignment{am.count !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outlet table with filters */}
      <div>
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search outlets or area managers…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          {amOptions.length > 0 && (
            <div className="relative">
              <select value={amFilter} onChange={e => setAmFilter(e.target.value)} className={cn(SELECT_CLS, amFilter && 'border-orange-400 text-orange-700 bg-orange-50')}>
                <option value="">All Area Managers</option>
                {amOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            </div>
          )}
          {pillarOptions.length > 0 && (
            <div className="relative">
              <select value={pillarFilter} onChange={e => setPillarFilter(e.target.value)} className={cn(SELECT_CLS, pillarFilter && 'border-orange-400 text-orange-700 bg-orange-50')}>
                <option value="">All Pillars</option>
                {pillarOptions.map(n => <option key={n} value={n}>Pillar {n}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            </div>
          )}
          {activeFilters > 0 && (
            <button onClick={() => { setAmFilter(''); setPillarFilter('') }} className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 whitespace-nowrap">
              Clear filters
            </button>
          )}
        </div>

        <div className="text-xs text-gray-400 mb-2">{outletRows.length} outlet{outletRows.length !== 1 ? 's' : ''} · {filtered.length} assignment{filtered.length !== 1 ? 's' : ''}</div>

        {outletRows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Store className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No outlets found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Outlet</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Area Manager</th>
                    {pillarOptions.map(n => (
                      <th key={n} className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Pillar {n}</th>
                    ))}
                    <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                      <TrendingUp className="h-3.5 w-3.5 inline mr-1" />Overall
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {outletRows.map(row => {
                    const overallAvg = row.pillars.length > 0
                      ? Math.round(row.pillars.reduce((s, p) => s + p.progress, 0) / row.pillars.length)
                      : 0
                    const pillarMap = new Map(row.pillars.map(p => [parsePillarNumber(p.title), p.progress]))
                    return (
                      <tr key={row.outletId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{row.outletName}</p>
                          {row.outletCode && <p className="text-xs text-gray-400 font-mono">{row.outletCode}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{row.amName}</td>
                        {pillarOptions.map(n => {
                          const pct = pillarMap.get(n)
                          return (
                            <td key={n} className="px-4 py-3">
                              {pct !== undefined ? (
                                <div className="flex flex-col items-center gap-1 min-w-[80px]">
                                  <span className="font-semibold text-gray-700">{Math.round(pct)}%</span>
                                  <ProgressBar pct={pct} className="w-16" />
                                </div>
                              ) : <span className="text-gray-300 text-xs block text-center">—</span>}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-1 min-w-[80px]">
                            <span className={cn('font-bold', overallAvg >= 100 ? 'text-green-600' : overallAvg >= 70 ? 'text-blue-600' : overallAvg >= 40 ? 'text-amber-600' : 'text-red-500')}>
                              {overallAvg}%
                            </span>
                            <ProgressBar pct={overallAvg} className="w-16" />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
