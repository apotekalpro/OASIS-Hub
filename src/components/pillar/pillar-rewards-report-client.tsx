'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type ReportRow = {
  outletId: string
  outletName: string
  outletCode: string | null
  areaManagerName: string | null
  pillarsTotal: number
  pillarsCompleted: number
  avgProgress: number
  revenue: number
  focusProductPct: number
  category: string | null
  incentive1Achieved: number
  incentive2Achieved: number
  incentive3Achieved: number
  totalAchieved: number
  totalPotential: number
}

type SortKey = keyof Pick<ReportRow, 'outletName' | 'areaManagerName' | 'category' | 'pillarsCompleted' | 'avgProgress' | 'revenue' | 'focusProductPct' | 'incentive1Achieved' | 'incentive2Achieved' | 'incentive3Achieved' | 'totalAchieved'>

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

function formatIDR(n: number) {
  return n.toLocaleString('id-ID')
}

export function PillarRewardsReportClient() {
  const months = monthOptions()
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  const [month, setMonth] = useState(currentMonth)
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('outletName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/pillar/rewards/report?month=${month}`)
      .then(r => r.json())
      .then(d => setRows(d.rows ?? []))
      .finally(() => setLoading(false))
  }, [month])

  const categories = useMemo(() =>
    Array.from(new Set(rows.map(r => r.category).filter((c): c is string => !!c))).sort()
  , [rows])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = rows
    if (q) result = result.filter(r =>
      r.outletName.toLowerCase().includes(q) ||
      (r.outletCode ?? '').toLowerCase().includes(q) ||
      (r.areaManagerName ?? '').toLowerCase().includes(q)
    )
    if (categoryFilter) result = result.filter(r => r.category === categoryFilter)
    return [...result].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, search, categoryFilter, sortKey, sortDir])

  const totals = filteredRows.reduce((acc, r) => ({
    incentive1: acc.incentive1 + r.incentive1Achieved,
    incentive2: acc.incentive2 + r.incentive2Achieved,
    incentive3: acc.incentive3 + r.incentive3Achieved,
    total: acc.total + r.totalAchieved,
  }), { incentive1: 0, incentive2: 0, incentive3: 0, total: 0 })

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  function Th({ col, label, right }: { col: SortKey; label: string; right?: boolean }) {
    return (
      <th
        className={`px-3 py-2 ${right ? 'text-right' : 'text-left'} cursor-pointer hover:bg-gray-100 select-none`}
        onClick={() => toggleSort(col)}
      >
        <span className={`inline-flex items-center gap-1 ${right ? 'flex-row-reverse' : ''}`}>
          {label} <SortIcon col={col} />
        </span>
      </th>
    )
  }

  function exportCSV() {
    const header = ['Outlet Code', 'Outlet Name', 'Area Manager', 'Category', 'Pillars Completed', 'Pillars Total', 'Avg Progress %', 'Revenue', 'Focus Product %', 'Incentive 1', 'Incentive 2', 'Incentive 3', 'Total Achieved', 'Total Potential']
    const lines = filteredRows.map(r => [
      r.outletCode ?? '', r.outletName, r.areaManagerName ?? '', r.category ?? '', r.pillarsCompleted, r.pillarsTotal, r.avgProgress,
      r.revenue, r.focusProductPct, Math.round(r.incentive1Achieved), Math.round(r.incentive2Achieved), Math.round(r.incentive3Achieved),
      Math.round(r.totalAchieved), Math.round(r.totalPotential),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pillar-rewards-${month.slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {months.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <Input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search outlet or AM…"
              className="pl-8 w-52"
            />
          </div>
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          )}
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={filteredRows.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Incentive 1</p><p className="text-lg font-bold text-gray-900">Rp {formatIDR(totals.incentive1)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Incentive 2</p><p className="text-lg font-bold text-gray-900">Rp {formatIDR(totals.incentive2)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Incentive 3</p><p className="text-lg font-bold text-gray-900">Rp {formatIDR(totals.incentive3)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Total Payout</p><p className="text-lg font-bold text-orange-600">Rp {formatIDR(totals.total)}</p></CardContent></Card>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <Th col="outletName" label="Outlet" />
              <Th col="areaManagerName" label="Area Manager" />
              <Th col="category" label="Category" />
              <Th col="pillarsCompleted" label="Pillars" right />
              <Th col="avgProgress" label="Avg %" right />
              <Th col="revenue" label="Revenue" right />
              <Th col="focusProductPct" label="Focus %" right />
              <Th col="incentive1Achieved" label="Inc 1" right />
              <Th col="incentive2Achieved" label="Inc 2" right />
              <Th col="incentive3Achieved" label="Inc 3" right />
              <Th col="totalAchieved" label="Total" right />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">No outlets found</td></tr>
            ) : filteredRows.map(r => (
              <tr key={r.outletId} className="hover:bg-gray-50">
                <td className="px-3 py-2"><p className="font-medium text-gray-900">{r.outletName}</p><p className="text-xs text-gray-400">{r.outletCode}</p></td>
                <td className="px-3 py-2 text-gray-600">{r.areaManagerName ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600 capitalize">{r.category ?? '—'}</td>
                <td className="px-3 py-2 text-right text-gray-600">{r.pillarsCompleted}/{r.pillarsTotal}</td>
                <td className="px-3 py-2 text-right text-gray-600">{r.avgProgress}%</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatIDR(r.revenue)}</td>
                <td className="px-3 py-2 text-right text-gray-600">{r.focusProductPct}%</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatIDR(Math.round(r.incentive1Achieved))}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatIDR(Math.round(r.incentive2Achieved))}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatIDR(Math.round(r.incentive3Achieved))}</td>
                <td className="px-3 py-2 text-right font-semibold text-orange-600">{formatIDR(Math.round(r.totalAchieved))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
