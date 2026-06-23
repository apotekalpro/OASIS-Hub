'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, Download, Save, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

const CATEGORY_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'titanium']
const CATEGORY_LABEL: Record<string, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', titanium: 'Titanium' }

type ParsedRow = { outletCode: string; outletName: string; category: string; t1: number; t2: number; t3: number }

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
  const [uploadResult, setUploadResult] = useState<number | null>(null)
  const months = nextMonths()

  useEffect(() => {
    fetch('/api/pillar/reward-tiers').then(r => r.json()).then(d => {
      const sorted = [...(d.tiers ?? [])].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
      setTiers(sorted)
    })
  }, [])

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
      const { count } = await res.json()
      setUploadResult(count)
      toast.success(`Uploaded ${count} target rows`)
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Upload failed' }))
      toast.error(error ?? 'Upload failed')
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
            <p className="flex items-center gap-1.5 text-sm text-green-600"><CheckCircle2 className="h-4 w-4" /> Uploaded {uploadResult} target rows</p>
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
    </div>
  )
}
