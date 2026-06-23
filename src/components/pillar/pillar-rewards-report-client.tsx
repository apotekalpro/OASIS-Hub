'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

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

type SortKey = keyof Pick<ReportRow, 'outletName' | 'areaManagerName' | 'category' | 'avgProgress' | 'revenue' | 'focusProductPct' | 'incentive1Achieved' | 'incentive2Achieved' | 'incentive3Achieved' | 'totalAchieved'>

export function PillarRewardsReportClient() {
  const months = monthOptions()
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  const [month, setMonth] = useState(currentMonth)
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('totalAchieved')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/pillar/rewards/report?month=${month}`)
      .then(r => r.json())
      .then(d => setRows(d.rows ?? []))
      .finally(() => setLoading(false))
  }, [month])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortHeader({ label, sortKeyVal, align = 'right' }: { label: string; sortKeyVal: SortKey; align?: 'left' | 'right' }) {
    const active = sortKey === sortKeyVal
    return (
      <th
        className={`px-3 py-2 cursor-pointer select-none hover:text-gray-700 ${align === 'right' ? 'text-right' : 'text-left'}`}
        onClick={() => toggleSort(sortKeyVal)}
      >
        <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          {label}
          {active ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </span>
      </th>
    )
  }

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? rows.filter(r =>
          r.outletName.toLowerCase().includes(q) ||
          (r.outletCode ?? '').toLowerCase().includes(q) ||
          (r.areaManagerName ?? '').toLowerCase().includes(q) ||
          (r.category ?? '').toLowerCase().includes(q)
        )
      : rows
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      let cmp: number
      if (typeof av === 'string' || typeof bv === 'string') {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''))
      } else {
        cmp = (Number(av) || 0) - (Number(bv) || 0)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [rows, search, sortKey, sortDir])

  const totals = rows.reduce((acc, r) => ({
    incentive1: acc.incentive1 + r.incentive1Achieved,
    incentive2: acc.incentive2 + r.incentive2Achieved,
    incentive3: acc.incentive3 + r.incentive3Achieved,
    total: acc.total + r.totalAchieved,
  }), { incentive1: 0, incentive2: 0, incentive3: 0, total: 0 })

  function exportCSV() {
    const header = ['Outlet Code', 'Outlet Name', 'Area Manager', 'Category', 'Pillars Completed', 'Pillars Total', 'Avg Progress %', 'Revenue', 'Focus Product %', 'Incentive 1', 'Incentive 2', 'Incentive 3', 'Total Achieved', 'Total Potential']
    const lines = rows.map(r => [
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search outlet, code, area manager, category..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
          </div>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={rows.length === 0}>
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
              <SortHeader label="Outlet" sortKeyVal="outletName" align="left" />
              <SortHeader label="Area Manager" sortKeyVal="areaManagerName" align="left" />
              <SortHeader label="Category" sortKeyVal="category" align="left" />
              <th className="px-3 py-2 text-right">Pillars</th>
              <SortHeader label="Avg %" sortKeyVal="avgProgress" />
              <SortHeader label="Revenue" sortKeyVal="revenue" />
              <SortHeader label="Focus %" sortKeyVal="focusProductPct" />
              <SortHeader label="Inc 1" sortKeyVal="incentive1Achieved" />
              <SortHeader label="Inc 2" sortKeyVal="incentive2Achieved" />
              <SortHeader label="Inc 3" sortKeyVal="incentive3Achieved" />
              <SortHeader label="Total" sortKeyVal="totalAchieved" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : filteredSorted.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">No outlets found</td></tr>
            ) : filteredSorted.map(r => (
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
