'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Search, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, Users, Store, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type ReportRow = {
  outletId: string
  outletName: string
  outletCode: string | null
  areaManagerName: string | null
  areaManagerId: string | null
  pillarsTotal: number
  pillarsCompleted: number
  avgProgress: number
  revenue: number
  forecastedRevenue: number
  asOfDate: string | null
  focusProductPct: number
  category: string | null
  t1: number | null
  t2: number | null
  t3: number | null
  incentive1Achieved: number
  incentive1Potential: number
  incentive2Achieved: number
  incentive2Potential: number
  incentive2TierHit: 0 | 1 | 2 | 3
  incentive3Achieved: number
  incentive3Potential: number
  totalAchieved: number
  totalPotential: number
  paxCount: number
  incentive1Forecasted: number
  incentive2Forecasted: number
  incentive2ForecastTierHit: 0 | 1 | 2 | 3
  incentive3Forecasted: number
  totalForecasted: number
}

function monthOptions() {
  const opts: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = -6; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const label = d.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
    opts.push({ value, label })
  }
  return opts.reverse()
}

function formatIDR(n: number) { return n.toLocaleString('id-ID') }

function TierBadge({ tier }: { tier: 0 | 1 | 2 | 3 }) {
  if (tier === 0) return <span className="text-xs text-gray-300">—</span>
  const cls = tier === 3 ? 'bg-amber-100 text-amber-700' : tier === 2 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
  return <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded', cls)}>L{tier}</span>
}

type SortKey = keyof Pick<ReportRow, 'outletName' | 'areaManagerName' | 'category' | 'avgProgress' | 'revenue' | 'forecastedRevenue' | 'focusProductPct' | 'paxCount' | 'incentive1Achieved' | 'incentive2Achieved' | 'incentive3Achieved' | 'totalAchieved' | 'incentive1Forecasted' | 'incentive2Forecasted' | 'incentive3Forecasted' | 'totalForecasted'>

function useSortState(init: SortKey, initDir: 'asc' | 'desc' = 'desc') {
  const [sortKey, setSortKey] = useState<SortKey>(init)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initDir)
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }
  function SortHeader({ label, sortKeyVal, align = 'right' }: { label: string; sortKeyVal: SortKey; align?: 'left' | 'right' }) {
    const active = sortKey === sortKeyVal
    return (
      <th className={`px-3 py-2 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => toggleSort(sortKeyVal)}>
        <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          {label}
          {active ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </span>
      </th>
    )
  }
  return { sortKey, sortDir, toggleSort, SortHeader }
}

export function PillarRewardsReportClient() {
  const months = monthOptions()
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  const [month, setMonth] = useState(currentMonth)
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [amFilter, setAmFilter] = useState('')
  const [view, setView] = useState<'outlet' | 'am'>('outlet')

  const outletSort = useSortState('totalAchieved')
  const amSort = useSortState('totalAchieved')
  const [syncingPax, setSyncingPax] = useState(false)
  const [paxSyncMsg, setPaxSyncMsg] = useState<string | null>(null)

  async function syncPax() {
    setSyncingPax(true); setPaxSyncMsg(null)
    try {
      const r = await fetch('/api/outlets/sync-pax', { method: 'POST' })
      const d = await r.json()
      if (d.error) { setPaxSyncMsg(`Error: ${d.error}`); return }
      setPaxSyncMsg(`Synced: ${d.updated} outlets updated, ${d.unmatched} unmatched`)
      // Reload report data with fresh pax counts
      fetch(`/api/pillar/rewards/report?month=${month}`).then(r => r.json()).then(d => setRows(d.rows ?? []))
    } catch { setPaxSyncMsg('Network error') }
    finally { setSyncingPax(false) }
  }

  useEffect(() => {
    setLoading(true)
    fetch(`/api/pillar/rewards/report?month=${month}`)
      .then(r => r.json())
      .then(d => setRows(d.rows ?? []))
      .finally(() => setLoading(false))
  }, [month])

  const amOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) {
      if (r.areaManagerId && r.areaManagerName) map.set(r.areaManagerId, r.areaManagerName)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (amFilter && r.areaManagerId !== amFilter) return false
      if (q && !r.outletName.toLowerCase().includes(q) && !(r.outletCode ?? '').toLowerCase().includes(q) && !(r.areaManagerName ?? '').toLowerCase().includes(q) && !(r.category ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, search, amFilter])

  const sortedOutletRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const av = a[outletSort.sortKey], bv = b[outletSort.sortKey]
      const cmp = typeof av === 'string' ? String(av).localeCompare(String(bv ?? '')) : (Number(av) || 0) - (Number(bv) || 0)
      return outletSort.sortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredRows, outletSort.sortKey, outletSort.sortDir])

  // AM-level aggregation
  const amRows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; outlets: ReportRow[] }>()
    for (const r of filteredRows) {
      const key = r.areaManagerId ?? '__none__'
      if (!map.has(key)) map.set(key, { id: key, name: r.areaManagerName ?? '—', outlets: [] })
      map.get(key)!.outlets.push(r)
    }
    return Array.from(map.values()).map(am => {
      const o = am.outlets
      return {
        id: am.id,
        name: am.name,
        outletCount: o.length,
        revenue: o.reduce((s, r) => s + r.revenue, 0),
        forecastedRevenue: o.reduce((s, r) => s + r.forecastedRevenue, 0),
        avgProgress: o.length > 0 ? Math.round(o.reduce((s, r) => s + r.avgProgress, 0) / o.length) : 0,
        focusProductPct: o.length > 0 ? Math.round(o.reduce((s, r) => s + r.focusProductPct, 0) / o.length * 10) / 10 : 0,
        incentive1Achieved: o.reduce((s, r) => s + r.incentive1Achieved, 0),
        incentive2Achieved: o.reduce((s, r) => s + r.incentive2Achieved, 0),
        incentive3Achieved: o.reduce((s, r) => s + r.incentive3Achieved, 0),
        totalAchieved: o.reduce((s, r) => s + r.totalAchieved, 0),
        incentive1Forecasted: o.reduce((s, r) => s + r.incentive1Forecasted, 0),
        incentive2Forecasted: o.reduce((s, r) => s + r.incentive2Forecasted, 0),
        incentive3Forecasted: o.reduce((s, r) => s + r.incentive3Forecasted, 0),
        totalForecasted: o.reduce((s, r) => s + r.totalForecasted, 0),
      }
    })
  }, [filteredRows])

  type AmSortKey = 'name' | 'outletCount' | 'revenue' | 'forecastedRevenue' | 'avgProgress' | 'focusProductPct' | 'incentive1Achieved' | 'incentive2Achieved' | 'incentive3Achieved' | 'totalAchieved'
  const [amSortKey, setAmSortKey] = useState<AmSortKey>('totalAchieved')
  const [amSortDir, setAmSortDir] = useState<'asc' | 'desc'>('desc')
  function toggleAmSort(key: AmSortKey) {
    if (amSortKey === key) setAmSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setAmSortKey(key); setAmSortDir('desc') }
  }
  function AmSortHeader({ label, k, align = 'right' }: { label: string; k: AmSortKey; align?: 'left' | 'right' }) {
    const active = amSortKey === k
    return (
      <th className={`px-3 py-2 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => toggleAmSort(k)}>
        <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          {label}
          {active ? (amSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </span>
      </th>
    )
  }

  const sortedAmRows = useMemo(() => {
    return [...amRows].sort((a, b) => {
      const av = a[amSortKey], bv = b[amSortKey]
      const cmp = typeof av === 'string' ? String(av).localeCompare(String(bv ?? '')) : (Number(av) || 0) - (Number(bv) || 0)
      return amSortDir === 'asc' ? cmp : -cmp
    })
  }, [amRows, amSortKey, amSortDir])

  const totals = rows.reduce((acc, r) => ({
    incentive1: acc.incentive1 + r.incentive1Achieved,
    incentive2: acc.incentive2 + r.incentive2Achieved,
    incentive3: acc.incentive3 + r.incentive3Achieved,
    total: acc.total + r.totalAchieved,
    inc1Forecast: acc.inc1Forecast + r.incentive1Forecasted,
    inc2Forecast: acc.inc2Forecast + r.incentive2Forecasted,
    inc3Forecast: acc.inc3Forecast + r.incentive3Forecasted,
    totalForecast: acc.totalForecast + r.totalForecasted,
  }), { incentive1: 0, incentive2: 0, incentive3: 0, total: 0, inc1Forecast: 0, inc2Forecast: 0, inc3Forecast: 0, totalForecast: 0 })

  function exportCSV() {
    const header = ['Outlet Code', 'Outlet Name', 'Area Manager', 'Category', 'Pillars', 'Avg %', 'Revenue', 'Forecasted Revenue', 'As Of Date', 'Focus %', 'T1', 'T2', 'T3', 'Inc2 Tier', 'PAX', 'Inc 1', 'Inc 1 Forecast', 'Inc 2', 'Inc 2 Forecast', 'Inc 3', 'Inc 3 Forecast', 'Total', 'Total Forecast']
    const lines = sortedOutletRows.map(r => [
      r.outletCode ?? '', r.outletName, r.areaManagerName ?? '', r.category ?? '',
      `${r.pillarsCompleted}/${r.pillarsTotal}`, r.avgProgress,
      Math.round(r.revenue), Math.round(r.forecastedRevenue), r.asOfDate ?? '',
      r.focusProductPct, r.t1 ?? '', r.t2 ?? '', r.t3 ?? '',
      r.incentive2TierHit > 0 ? `L${r.incentive2TierHit}` : '',
      r.paxCount,
      Math.round(r.incentive1Achieved), Math.round(r.incentive1Forecasted),
      Math.round(r.incentive2Achieved), Math.round(r.incentive2Forecasted),
      Math.round(r.incentive3Achieved), Math.round(r.incentive3Forecasted),
      Math.round(r.totalAchieved), Math.round(r.totalForecasted),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `incentives-summary-${month.slice(0, 7)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const SELECT_CLS = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white h-10 appearance-none pr-8'

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={e => setMonth(e.target.value)} className={SELECT_CLS}>
            {months.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search outlet, code, AM, category…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
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
          {(search || amFilter) && (
            <button onClick={() => { setSearch(''); setAmFilter('') }} className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2">Clear</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <Button variant="outline" size="sm" onClick={syncPax} disabled={syncingPax} className="gap-1.5">
              <RefreshCw className={cn('h-4 w-4', syncingPax && 'animate-spin')} /> Sync Pax
            </Button>
            {paxSyncMsg && <p className="text-xs text-gray-400 mt-0.5">{paxSyncMsg}</p>}
          </div>
          <Button variant="outline" onClick={exportCSV} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Incentive 1</p>
          <p className="text-lg font-bold text-gray-900">Rp {formatIDR(Math.round(totals.incentive1))}</p>
          <p className="text-xs text-purple-500 mt-0.5">↗ Rp {formatIDR(Math.round(totals.inc1Forecast))} forecasted</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Incentive 2</p>
          <p className="text-lg font-bold text-gray-900">Rp {formatIDR(Math.round(totals.incentive2))}</p>
          <p className="text-xs text-purple-500 mt-0.5">↗ Rp {formatIDR(Math.round(totals.inc2Forecast))} forecasted</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Incentive 3</p>
          <p className="text-lg font-bold text-gray-900">Rp {formatIDR(Math.round(totals.incentive3))}</p>
          <p className="text-xs text-purple-500 mt-0.5">↗ Rp {formatIDR(Math.round(totals.inc3Forecast))} forecasted</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Total Payout</p>
          <p className="text-lg font-bold text-orange-600">Rp {formatIDR(Math.round(totals.total))}</p>
          <p className="text-xs text-purple-500 mt-0.5">↗ Rp {formatIDR(Math.round(totals.totalForecast))} forecasted</p>
        </CardContent></Card>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button onClick={() => setView('outlet')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors', view === 'outlet' ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-gray-200 text-gray-500 hover:text-gray-700')}>
          <Store className="h-4 w-4" />Outlet View
        </button>
        <button onClick={() => setView('am')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors', view === 'am' ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-gray-200 text-gray-500 hover:text-gray-700')}>
          <Users className="h-4 w-4" />Area Manager View
        </button>
      </div>

      {/* OUTLET TABLE */}
      {view === 'outlet' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <outletSort.SortHeader label="Outlet" sortKeyVal="outletName" align="left" />
                <outletSort.SortHeader label="Area Manager" sortKeyVal="areaManagerName" align="left" />
                <outletSort.SortHeader label="Category" sortKeyVal="category" align="left" />
                <th className="px-3 py-2 text-right whitespace-nowrap">Pillars</th>
                <outletSort.SortHeader label="Avg %" sortKeyVal="avgProgress" />
                <outletSort.SortHeader label="Revenue" sortKeyVal="revenue" />
                <outletSort.SortHeader label="Forecast EOM" sortKeyVal="forecastedRevenue" />
                <th className="px-3 py-2 text-center whitespace-nowrap text-purple-500">L1 / L2 / L3</th>
                <outletSort.SortHeader label="Focus %" sortKeyVal="focusProductPct" />
                <outletSort.SortHeader label="PAX" sortKeyVal="paxCount" />
                <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer select-none hover:text-gray-700" onClick={() => outletSort.toggleSort('incentive1Achieved')}>
                  <span className="inline-flex items-center gap-1 flex-row-reverse">Inc 1{outletSort.sortKey === 'incentive1Achieved' ? (outletSort.sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}</span>
                  <span className="block text-xs font-normal text-purple-400 cursor-pointer" onClick={e => { e.stopPropagation(); outletSort.toggleSort('incentive1Forecasted') }}>↗ Forecast</span>
                </th>
                <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer select-none hover:text-gray-700" onClick={() => outletSort.toggleSort('incentive2Achieved')}>
                  <span className="inline-flex items-center gap-1 flex-row-reverse">Inc 2{outletSort.sortKey === 'incentive2Achieved' ? (outletSort.sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}</span>
                  <span className="block text-xs font-normal text-purple-400 cursor-pointer" onClick={e => { e.stopPropagation(); outletSort.toggleSort('incentive2Forecasted') }}>↗ Forecast</span>
                </th>
                <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer select-none hover:text-gray-700" onClick={() => outletSort.toggleSort('incentive3Achieved')}>
                  <span className="inline-flex items-center gap-1 flex-row-reverse">Inc 3{outletSort.sortKey === 'incentive3Achieved' ? (outletSort.sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}</span>
                  <span className="block text-xs font-normal text-purple-400 cursor-pointer" onClick={e => { e.stopPropagation(); outletSort.toggleSort('incentive3Forecasted') }}>↗ Forecast</span>
                </th>
                <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer select-none hover:text-gray-700" onClick={() => outletSort.toggleSort('totalAchieved')}>
                  <span className="inline-flex items-center gap-1 flex-row-reverse">Total{outletSort.sortKey === 'totalAchieved' ? (outletSort.sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}</span>
                  <span className="block text-xs font-normal text-purple-400 cursor-pointer" onClick={e => { e.stopPropagation(); outletSort.toggleSort('totalForecasted') }}>↗ Forecast</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={14} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : sortedOutletRows.length === 0 ? (
                <tr><td colSpan={14} className="px-3 py-8 text-center text-gray-400">No outlets found</td></tr>
              ) : sortedOutletRows.map(r => (
                <tr key={r.outletId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap"><p className="font-medium text-gray-900">{r.outletName}</p><p className="text-xs text-gray-400">{r.outletCode}</p></td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.areaManagerName ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600 capitalize whitespace-nowrap">{r.category ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{r.pillarsCompleted}/{r.pillarsTotal}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{r.avgProgress}%</td>
                  <td className="px-3 py-2 text-right text-gray-600">{formatIDR(Math.round(r.revenue))}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-purple-600 font-medium">{formatIDR(Math.round(r.forecastedRevenue))}</span>
                    {r.asOfDate && <p className="text-xs text-gray-400">as of {r.asOfDate}</p>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                      <span>{r.t1 != null ? formatIDR(r.t1) : '—'}</span>
                      <span className="text-gray-300">/</span>
                      <span>{r.t2 != null ? formatIDR(r.t2) : '—'}</span>
                      <span className="text-gray-300">/</span>
                      <span>{r.t3 != null ? formatIDR(r.t3) : '—'}</span>
                    </div>
                    <div className="flex justify-center mt-0.5"><TierBadge tier={r.incentive2TierHit} /></div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">{r.focusProductPct}%</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-700">{r.paxCount}</td>
                  <td className="px-3 py-2 text-right">
                    <p className="text-gray-600">{formatIDR(Math.round(r.incentive1Achieved))}</p>
                    {r.incentive1Forecasted !== r.incentive1Achieved && <p className="text-xs text-purple-500">↗ {formatIDR(Math.round(r.incentive1Forecasted))}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <p className="text-gray-600">{formatIDR(Math.round(r.incentive2Achieved))}</p>
                    {r.incentive2Forecasted !== r.incentive2Achieved && <p className="text-xs text-purple-500">↗ {formatIDR(Math.round(r.incentive2Forecasted))}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <p className="text-gray-600">{formatIDR(Math.round(r.incentive3Achieved))}</p>
                    {r.incentive3Forecasted !== r.incentive3Achieved && <p className="text-xs text-purple-500">↗ {formatIDR(Math.round(r.incentive3Forecasted))}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <p className="font-semibold text-orange-600">{formatIDR(Math.round(r.totalAchieved))}</p>
                    {r.totalForecasted !== r.totalAchieved && <p className="text-xs text-purple-500">↗ {formatIDR(Math.round(r.totalForecasted))}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AM TABLE */}
      {view === 'am' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <AmSortHeader label="Area Manager" k="name" align="left" />
                <AmSortHeader label="Outlets" k="outletCount" />
                <AmSortHeader label="Avg %" k="avgProgress" />
                <AmSortHeader label="Revenue" k="revenue" />
                <AmSortHeader label="Forecast EOM" k="forecastedRevenue" />
                <AmSortHeader label="Focus %" k="focusProductPct" />
                <AmSortHeader label="Inc 1" k="incentive1Achieved" />
                <AmSortHeader label="Inc 2" k="incentive2Achieved" />
                <AmSortHeader label="Inc 3" k="incentive3Achieved" />
                <AmSortHeader label="Total" k="totalAchieved" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : sortedAmRows.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">No area managers found</td></tr>
              ) : sortedAmRows.map(am => (
                <tr key={am.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{am.name}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{am.outletCount}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{am.avgProgress}%</td>
                  <td className="px-3 py-2 text-right text-gray-600">{formatIDR(Math.round(am.revenue))}</td>
                  <td className="px-3 py-2 text-right font-medium text-purple-600">{formatIDR(Math.round(am.forecastedRevenue))}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{am.focusProductPct}%</td>
                  <td className="px-3 py-2 text-right">
                    <p className="text-gray-600">{formatIDR(Math.round(am.incentive1Achieved))}</p>
                    {am.incentive1Forecasted !== am.incentive1Achieved && <p className="text-xs text-purple-500">↗ {formatIDR(Math.round(am.incentive1Forecasted))}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <p className="text-gray-600">{formatIDR(Math.round(am.incentive2Achieved))}</p>
                    {am.incentive2Forecasted !== am.incentive2Achieved && <p className="text-xs text-purple-500">↗ {formatIDR(Math.round(am.incentive2Forecasted))}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <p className="text-gray-600">{formatIDR(Math.round(am.incentive3Achieved))}</p>
                    {am.incentive3Forecasted !== am.incentive3Achieved && <p className="text-xs text-purple-500">↗ {formatIDR(Math.round(am.incentive3Forecasted))}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <p className="font-semibold text-orange-600">{formatIDR(Math.round(am.totalAchieved))}</p>
                    {am.totalForecasted !== am.totalAchieved && <p className="text-xs text-purple-500">↗ {formatIDR(Math.round(am.totalForecasted))}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
