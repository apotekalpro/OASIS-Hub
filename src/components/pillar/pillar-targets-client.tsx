'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { Upload, Download, Save, CheckCircle2, XCircle, Search, ArrowUp, ArrowDown, ArrowUpDown, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { parseCSV } from '@/lib/utils'
import { toast } from 'sonner'

type Tier = {
  id: string
  category: string
  revenue_min: number
  revenue_max: number | null
  t1_reward: number
  t2_reward: number
  t3_reward: number
}

type TargetRow = {
  id: string
  outlet_id: string | null
  outlet_code: string
  outlet_name: string | null
  category: string
  month: string
  t1: number
  t2: number
  t3: number
}

const CATEGORY_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'titanium']
const CATEGORY_LABEL: Record<string, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', titanium: 'Titanium' }

type ParsedRow = { outletCode: string; outletName: string; category: string; t1: number; t2: number; t3: number }

type SortKey = 'outlet_code' | 'outlet_name' | 'category' | 'month' | 't1' | 't2' | 't3'

function nextMonths(count = 12) {
  const opts: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const label = d.toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })
    opts.push({ value, label })
  }
  return opts
}

export function PillarTargetsClient() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [savingTiers, setSavingTiers] = useState(false)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number; unmatched: string[] } | null>(null)
  const months = nextMonths()

  const [targets, setTargets] = useState<TargetRow[]>([])
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [targetSearch, setTargetSearch] = useState('')
  const [targetMonthFilter, setTargetMonthFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('outlet_code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ category: string; t1: string; t2: string; t3: string }>({ category: 'bronze', t1: '0', t2: '0', t3: '0' })
  const [rowSaving, setRowSaving] = useState(false)

  useEffect(() => {
    fetch('/api/pillar/reward-tiers').then(r => r.json()).then(d => {
      const sorted = [...(d.tiers ?? [])].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
      setTiers(sorted)
    })
  }, [])

  function loadTargets() {
    setLoadingTargets(true)
    const url = targetMonthFilter ? `/api/pillar/targets?month=${targetMonthFilter}` : '/api/pillar/targets'
    fetch(url).then(r => r.json()).then(d => setTargets(d.targets ?? [])).finally(() => setLoadingTargets(false))
  }

  useEffect(() => { loadTargets() }, [targetMonthFilter])

  function updateTier(id: string, patch: Partial<Tier>) {
    setTiers(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  async function saveTiers() {
    setSavingTiers(true)
    const res = await fetch('/api/pillar/reward-tiers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiers }),
    })
    setSavingTiers(false)
    if (res.ok) toast.success('Reward matrix saved')
    else toast.error('Failed to save reward matrix')
  }

  function toggleMonth(m: string) {
    setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setUploadResult(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      const get = (row: Record<string, string>, ...keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(row).find(h => h.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase().replace(/[\s_-]/g, ''))
          if (found && row[found]?.trim()) return row[found].trim()
        }
        return ''
      }
      const normalised: ParsedRow[] = parsed.map(row => ({
        outletCode: get(row, 'outletcode', 'code'),
        outletName: get(row, 'outletname', 'name'),
        category: get(row, 'category').toLowerCase() || 'bronze',
        t1: Number(get(row, 't1')) || 0,
        t2: Number(get(row, 't2')) || 0,
        t3: Number(get(row, 't3')) || 0,
      })).filter(r => r.outletCode)
      setRows(normalised)
    }
    reader.readAsText(file)
  }

  function downloadTemplate() {
    const csv = 'Outlet Code,Outlet Name,Category,T1,T2,T3\nPJ-001,Alpro Petaling Jaya,Bronze,100000000,130000000,150000000\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pillar-targets-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleUpload() {
    if (rows.length === 0) return toast.error('Select a CSV file first')
    if (selectedMonths.length === 0) return toast.error('Select at least one month')
    setUploading(true)
    const res = await fetch('/api/pillar/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, months: selectedMonths }),
    })
    setUploading(false)
    if (res.ok) {
      const { successCount, failedCount, unmatchedCodes } = await res.json()
      setUploadResult({ success: successCount ?? 0, failed: failedCount ?? 0, unmatched: unmatchedCodes ?? [] })
      if (failedCount > 0) toast.error(`Uploaded ${successCount} rows, ${failedCount} outlet code(s) not recognized`)
      else toast.success(`Uploaded ${successCount} target rows`)
      loadTargets()
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Upload failed' }))
      toast.error(error ?? 'Upload failed')
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortHeader({ label, sortKeyVal, align = 'left' }: { label: string; sortKeyVal: SortKey; align?: 'left' | 'right' }) {
    const active = sortKey === sortKeyVal
    return (
      <th className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'}`}>
        <button type="button" onClick={() => toggleSort(sortKeyVal)} className={`flex items-center gap-1 ${align === 'right' ? 'ml-auto' : ''} ${active ? 'text-orange-600' : 'text-gray-500'} hover:text-orange-600`}>
          {label}
          {active ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-50" />}
        </button>
      </th>
    )
  }

  const filteredSortedTargets = useMemo(() => {
    const q = targetSearch.trim().toLowerCase()
    let list = targets
    if (q) {
      list = list.filter(t =>
        t.outlet_code.toLowerCase().includes(q) ||
        (t.outlet_name ?? '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
    }
    const sorted = [...list].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [targets, targetSearch, sortKey, sortDir])

  function startEdit(t: TargetRow) {
    setEditingId(t.id)
    setEditDraft({ category: t.category, t1: String(t.t1), t2: String(t.t2), t3: String(t.t3) })
  }

  async function saveEdit() {
    if (!editingId) return
    setRowSaving(true)
    const res = await fetch(`/api/pillar/targets/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: editDraft.category, t1: Number(editDraft.t1) || 0, t2: Number(editDraft.t2) || 0, t3: Number(editDraft.t3) || 0 }),
    })
    setRowSaving(false)
    if (res.ok) {
      const { target } = await res.json()
      setTargets(prev => prev.map(t => t.id === editingId ? target : t))
      setEditingId(null)
      toast.success('Target updated')
    } else {
      toast.error('Failed to update target')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Reward Tier Matrix (Incentive 2 &amp; 3, per staff)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-xs">
                  <th className="text-left px-3 py-2">Category</th>
                  <th className="text-right px-3 py-2">Revenue Min</th>
                  <th className="text-right px-3 py-2">Revenue Max</th>
                  <th className="text-right px-3 py-2">T1 Reward</th>
                  <th className="text-right px-3 py-2">T2 Reward</th>
                  <th className="text-right px-3 py-2">T3 Reward</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map(t => (
                  <tr key={t.id} className="border-b border-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{CATEGORY_LABEL[t.category] ?? t.category}</td>
                    <td className="px-3 py-2"><input type="number" value={t.revenue_min} onChange={e => updateTier(t.id, { revenue_min: Number(e.target.value) })} className="w-full text-right border border-gray-200 rounded px-2 py-1 text-xs" /></td>
                    <td className="px-3 py-2"><input type="number" value={t.revenue_max ?? ''} onChange={e => updateTier(t.id, { revenue_max: e.target.value === '' ? null : Number(e.target.value) })} className="w-full text-right border border-gray-200 rounded px-2 py-1 text-xs" placeholder="open-ended" /></td>
                    <td className="px-3 py-2"><input type="number" value={t.t1_reward} onChange={e => updateTier(t.id, { t1_reward: Number(e.target.value) })} className="w-full text-right border border-gray-200 rounded px-2 py-1 text-xs" /></td>
                    <td className="px-3 py-2"><input type="number" value={t.t2_reward} onChange={e => updateTier(t.id, { t2_reward: Number(e.target.value) })} className="w-full text-right border border-gray-200 rounded px-2 py-1 text-xs" /></td>
                    <td className="px-3 py-2"><input type="number" value={t.t3_reward} onChange={e => updateTier(t.id, { t3_reward: Number(e.target.value) })} className="w-full text-right border border-gray-200 rounded px-2 py-1 text-xs" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveTiers} loading={savingTiers}><Save className="h-3.5 w-3.5" /> Save Matrix</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Upload Monthly Revenue Targets</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Apply to months</p>
            <div className="flex flex-wrap gap-1.5">
              {months.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => toggleMonth(m.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedMonths.includes(m.value)
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            {fileName ? <p className="text-sm font-medium text-orange-600">{fileName}</p> : <p className="text-sm text-gray-500">Click to select a CSV file</p>}
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
          </div>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs text-orange-600 hover:underline">
            <Download className="h-3.5 w-3.5" /> Download template CSV
          </button>

          {rows.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">T1</th>
                    <th className="px-3 py-2 text-right">T2</th>
                    <th className="px-3 py-2 text-right">T3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.outletCode}</td>
                      <td className="px-3 py-2 text-gray-800">{r.outletName || '—'}</td>
                      <td className="px-3 py-2 text-gray-600 capitalize">{r.category}</td>
                      <td className="px-3 py-2 text-right">{r.t1.toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2 text-right">{r.t2.toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2 text-right">{r.t3.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && <p className="text-xs text-gray-400 text-center py-2">… and {rows.length - 10} more rows</p>}
            </div>
          )}

          {uploadResult !== null && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-4 text-sm">
                <p className="flex items-center gap-1.5 text-green-600"><CheckCircle2 className="h-4 w-4" /> {uploadResult.success} succeeded</p>
                {uploadResult.failed > 0 && (
                  <p className="flex items-center gap-1.5 text-red-600"><XCircle className="h-4 w-4" /> {uploadResult.failed} failed</p>
                )}
              </div>
              {uploadResult.unmatched.length > 0 && (
                <p className="text-xs text-red-500">
                  Outlet code(s) not found, saved without a linked outlet: {uploadResult.unmatched.join(', ')}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {rows.length > 0 && selectedMonths.length === 0 && (
              <p className="text-xs text-amber-600">Select at least one month above to enable upload</p>
            )}
            <Button onClick={handleUpload} loading={uploading} disabled={rows.length === 0 || selectedMonths.length === 0}>
              Upload {rows.length > 0 ? `${rows.length} Outlet${rows.length > 1 ? 's' : ''}` : ''}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Uploaded Targets</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search by code, name, category..." value={targetSearch} onChange={e => setTargetSearch(e.target.value)} className="pl-9" />
            </div>
            <select
              value={targetMonthFilter}
              onChange={e => setTargetMonthFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">All months</option>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide">
                <tr>
                  <SortHeader label="Code" sortKeyVal="outlet_code" />
                  <SortHeader label="Name" sortKeyVal="outlet_name" />
                  <SortHeader label="Category" sortKeyVal="category" />
                  <SortHeader label="Month" sortKeyVal="month" />
                  <SortHeader label="L1" sortKeyVal="t1" align="right" />
                  <SortHeader label="L2" sortKeyVal="t2" align="right" />
                  <SortHeader label="L3" sortKeyVal="t3" align="right" />
                  <th className="px-3 py-2 text-right">Linked</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSortedTargets.map(t => {
                  const editing = editingId === t.id
                  return (
                    <tr key={t.id} className={editing ? 'bg-orange-50/40' : ''}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{t.outlet_code}</td>
                      <td className="px-3 py-2 text-gray-800">{t.outlet_name || '—'}</td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <select value={editDraft.category} onChange={e => setEditDraft(d => ({ ...d, category: e.target.value }))} className="border border-gray-200 rounded px-1.5 py-1 text-xs capitalize">
                            {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                          </select>
                        ) : (
                          <span className="capitalize text-gray-600">{t.category}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{new Date(t.month + 'T00:00:00').toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })}</td>
                      <td className="px-3 py-2 text-right">
                        {editing ? <input type="number" value={editDraft.t1} onChange={e => setEditDraft(d => ({ ...d, t1: e.target.value }))} className="w-24 text-right border border-gray-200 rounded px-1.5 py-1 text-xs" /> : t.t1.toLocaleString('id-ID')}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editing ? <input type="number" value={editDraft.t2} onChange={e => setEditDraft(d => ({ ...d, t2: e.target.value }))} className="w-24 text-right border border-gray-200 rounded px-1.5 py-1 text-xs" /> : t.t2.toLocaleString('id-ID')}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editing ? <input type="number" value={editDraft.t3} onChange={e => setEditDraft(d => ({ ...d, t3: e.target.value }))} className="w-24 text-right border border-gray-200 rounded px-1.5 py-1 text-xs" /> : t.t3.toLocaleString('id-ID')}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {t.outlet_id ? <CheckCircle2 className="h-4 w-4 text-green-500 inline" /> : <XCircle className="h-4 w-4 text-red-400 inline" />}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {editing ? (
                          <div className="flex items-center gap-1 justify-end">
                            <button type="button" onClick={saveEdit} disabled={rowSaving} className="text-green-600 hover:text-green-700 disabled:opacity-50">
                              {rowSaving ? <span className="text-xs animate-pulse">Saving…</span> : <Check className="h-4 w-4" />}
                            </button>
                            <button type="button" onClick={() => setEditingId(null)} disabled={rowSaving} className="text-gray-400 hover:text-gray-600 disabled:opacity-50"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => startEdit(t)} className="text-gray-400 hover:text-orange-600"><Pencil className="h-3.5 w-3.5" /></button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {!loadingTargets && filteredSortedTargets.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400 text-sm">No targets found</td></tr>
                )}
                {loadingTargets && (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400 text-sm">Loading…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
