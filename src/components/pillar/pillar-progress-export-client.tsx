'use client'

import { useRef, useState } from 'react'
import { Download, Upload, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { parseCSV } from '@/lib/utils'
import { toast } from 'sonner'

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

function currentMonth() {
  return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
}

// ── Generic CSV helpers ─────────────────────────────────────────────────────

function getCol(row: Record<string, string>, ...keys: string[]) {
  for (const k of keys) {
    const found = Object.keys(row).find(h => h.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase().replace(/[\s_-]/g, ''))
    if (found && row[found]?.trim()) return row[found].trim()
  }
  return ''
}

function buildBlob(header: string[], lines: string[][]): string {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [header.map(escape).join(','), ...lines.map(l => l.map(escape).join(','))].join('\n')
}

function triggerDownload(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Types ───────────────────────────────────────────────────────────────────

type KrFailedRow = { krId: string; outletCode?: string; outletName?: string; pillar?: string; keyResult?: string; reason: string }
type KrUploadResult = { success: number; failed: number; failedRows: KrFailedRow[]; fatalError?: string }

type InputFailedRow = { outletId: string; outletCode?: string; outletName?: string; reason: string }
type InputUploadResult = { success: number; failed: number; failedRows: InputFailedRow[]; fatalError?: string }

// ── Card 1: Key Result progress ─────────────────────────────────────────────

function KrProgressCard({ month }: { month: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<KrUploadResult | null>(null)

  async function downloadCSV() {
    const d = await fetch(`/api/pillar/assignments?month=${month}`).then(r => r.json())
    const assignments = d.assignments ?? []
    type Kr = { id: string; title: string; metric_type: string; start_value: number; target_value: number; current_value: number; unit: string | null; status: string }
    type Assignment = { id: string; title: string; outlets: { name: string; code: string } | null; pillar_assignment_krs: Kr[] }
    const krRows = (assignments as Assignment[]).flatMap((a: Assignment) =>
      (a.pillar_assignment_krs ?? []).map(kr => ({ assignment: a, kr }))
    )
    if (krRows.length === 0) { toast.error('No key results found'); return }
    const header = ['KR ID', 'Outlet Code', 'Outlet Name', 'Pillar', 'Key Result', 'Metric Type', 'Start', 'Target', 'Current Value', 'Unit', 'Status', 'Progress %']
    const lines = krRows.map(({ assignment, kr }) => {
      const range = kr.target_value - kr.start_value
      const pct = kr.metric_type === 'boolean' ? (kr.current_value >= 1 ? 100 : 0)
        : range === 0 ? 0 : Math.min(100, Math.max(0, Math.round(((kr.current_value - kr.start_value) / range) * 100)))
      return [kr.id, assignment.outlets?.code ?? '', assignment.outlets?.name ?? '', assignment.title, kr.title, kr.metric_type, kr.start_value, kr.target_value, kr.current_value, kr.unit ?? '', kr.status, pct]
    })
    triggerDownload(buildBlob(header, lines as string[][]), `pillar-progress-${month.slice(0, 7)}.csv`)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setResult(null)
    const reader = new FileReader()
    reader.onload = async ev => {
      const parsed = parseCSV(ev.target?.result as string)
      const csvMap = new Map<string, Omit<KrFailedRow, 'reason'>>()
      const rows = parsed.map(row => {
        const krId = getCol(row, 'krid', 'kr id')
        if (krId) csvMap.set(krId, { krId, outletCode: getCol(row, 'outletcode', 'outlet code'), outletName: getCol(row, 'outletname', 'outlet name'), pillar: getCol(row, 'pillar'), keyResult: getCol(row, 'keyresult', 'key result') })
        const targetRaw = getCol(row, 'targetvalue', 'target')
        return {
          krId,
          title: getCol(row, 'keyresult', 'key result') || undefined,
          metricType: getCol(row, 'metrictype', 'metric type') || undefined,
          currentValue: Number(getCol(row, 'currentvalue', 'current value')) || 0,
          targetValue: targetRaw !== '' ? Number(targetRaw) || undefined : undefined,
          status: getCol(row, 'status').toLowerCase().replace(/\s+/g, '_'),
        }
      }).filter(r => r.krId)
      if (rows.length === 0) { toast.error('No valid rows found — KR ID column must be intact'); return }

      setUploading(true)
      let res: Response
      try { res = await fetch('/api/pillar/krs/bulk-update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) }) }
      catch (err) { setUploading(false); setResult({ success: 0, failed: rows.length, failedRows: [], fatalError: err instanceof Error ? err.message : 'Network error' }); return }
      setUploading(false)
      const json = await res.json().catch(() => null)
      if (res.ok && json) {
        const enriched = (json.failedRows ?? []).map((f: { krId: string; reason: string }) => ({ ...f, ...(csvMap.get(f.krId) ?? {}) }))
        setResult({ success: json.successCount ?? 0, failed: json.failedCount ?? 0, failedRows: enriched })
        if (json.failedCount > 0) toast.error(`Updated ${json.successCount}, failed ${json.failedCount}`)
        else toast.success(`Updated ${json.successCount} key results`)
      } else {
        setResult({ success: 0, failed: rows.length, failedRows: [], fatalError: json?.error ?? `Server error ${res.status}` })
      }
    }
    reader.readAsText(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Pillar Key Result Progress</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={downloadCSV}><Download className="h-4 w-4" /> Export KR Progress</Button>
          <UploadZone fileRef={fileRef} fileName={fileName} uploading={uploading} onChange={handleFile} />
        </div>
        <p className="text-xs text-gray-400">Edit &quot;Key Result&quot;, &quot;Target&quot;, &quot;Current Value&quot;, &quot;Metric Type&quot;, and/or &quot;Status&quot; columns. Don&apos;t touch &quot;KR ID&quot;.</p>
        {uploading && <p className="text-xs text-gray-500 animate-pulse">Updating key results…</p>}
        {result && <UploadResultDisplay result={result} colHeaders={['Outlet', 'Pillar', 'Key Result', 'KR ID', 'Reason']}
          renderRow={r => [r.outletName || r.outletCode || '—', (r as KrFailedRow).pillar || '—', (r as KrFailedRow).keyResult || '—', r.krId || (r as InputFailedRow).outletId || '—', r.reason]} />}
      </CardContent>
    </Card>
  )
}

// ── Card 2: Monthly revenue + focus product % ───────────────────────────────

function MonthlyInputsCard({ month }: { month: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<InputUploadResult | null>(null)

  async function downloadCSV() {
    const d = await fetch(`/api/pillar/monthly-inputs/bulk-update?month=${month}`).then(r => r.json())
    if (d.error) { toast.error(d.error); return }
    const rows: { outletId: string; outletCode: string; outletName: string; revenue: number; focusProductPct: number; asOfDate: string }[] = d.rows ?? []
    if (rows.length === 0) { toast.error('No outlets found'); return }
    const header = ['Outlet ID', 'Outlet Code', 'Outlet Name', 'Revenue (Rp)', 'Focus Product %', 'As Of Date']
    const lines = rows.map(r => [r.outletId, r.outletCode, r.outletName, r.revenue, r.focusProductPct, r.asOfDate])
    triggerDownload(buildBlob(header, lines as string[][]), `pillar-monthly-inputs-${month.slice(0, 7)}.csv`)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setResult(null)
    const reader = new FileReader()
    reader.onload = async ev => {
      const parsed = parseCSV(ev.target?.result as string)
      const csvMap = new Map<string, { outletCode: string; outletName: string }>()
      const rows = parsed.map(row => {
        const outletId = getCol(row, 'outletid', 'outlet id')
        const outletCode = getCol(row, 'outletcode', 'outlet code')
        const outletName = getCol(row, 'outletname', 'outlet name')
        if (outletId) csvMap.set(outletId, { outletCode, outletName })
        const revRaw = getCol(row, 'revenue', 'revenuerp', 'revenue(rp)')
        const focusRaw = getCol(row, 'focusproduct', 'focusproductpct', 'focusproduct%')
        const asOfDate = getCol(row, 'asofdate', 'as of date')
        return {
          outletId,
          month,
          revenue: revRaw !== '' ? Number(revRaw.replace(/[^0-9.-]/g, '')) : undefined,
          focusProductPct: focusRaw !== '' ? Number(focusRaw.replace(/[^0-9.-]/g, '')) : undefined,
          asOfDate: asOfDate || undefined,
        }
      }).filter(r => r.outletId)
      if (rows.length === 0) { toast.error('No valid rows — Outlet ID column must be intact'); return }

      setUploading(true)
      let res: Response
      try { res = await fetch('/api/pillar/monthly-inputs/bulk-update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) }) }
      catch (err) { setUploading(false); setResult({ success: 0, failed: rows.length, failedRows: [], fatalError: err instanceof Error ? err.message : 'Network error' }); return }
      setUploading(false)
      const json = await res.json().catch(() => null)
      if (res.ok && json) {
        const enriched = (json.failedRows ?? []).map((f: { outletId: string; reason: string }) => ({ ...f, ...(csvMap.get(f.outletId) ?? {}) }))
        setResult({ success: json.successCount ?? 0, failed: json.failedCount ?? 0, failedRows: enriched })
        if (json.failedCount > 0) toast.error(`Updated ${json.successCount}, failed ${json.failedCount}`)
        else toast.success(`Updated ${json.successCount} outlets`)
      } else {
        setResult({ success: 0, failed: rows.length, failedRows: [], fatalError: json?.error ?? `Server error ${res.status}` })
      }
    }
    reader.readAsText(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Incentive 2 &amp; 3 — Revenue &amp; Focus Product %</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={downloadCSV}><Download className="h-4 w-4" /> Export Revenue &amp; Focus %</Button>
          <UploadZone fileRef={fileRef} fileName={fileName} uploading={uploading} onChange={handleFile} />
        </div>
        <p className="text-xs text-gray-400">
          Edit &quot;Revenue (Rp)&quot;, &quot;Focus Product %&quot;, and/or &quot;As Of Date&quot; columns. Don&apos;t touch &quot;Outlet ID&quot; — it links each row back to the correct outlet.
          Leave a cell blank to keep the existing value unchanged.
        </p>
        {uploading && <p className="text-xs text-gray-500 animate-pulse">Updating outlets…</p>}
        {result && <UploadResultDisplay result={result} colHeaders={['Outlet', 'Outlet ID', 'Reason']}
          renderRow={r => [(r as InputFailedRow).outletName || (r as InputFailedRow).outletCode || '—', (r as InputFailedRow).outletId || '—', r.reason]} />}
      </CardContent>
    </Card>
  )
}

// ── Shared UI components ────────────────────────────────────────────────────

function UploadZone({ fileRef, fileName, uploading, onChange }: {
  fileRef: React.RefObject<HTMLInputElement | null>
  fileName: string
  uploading: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div
      className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-2.5 cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-colors flex items-center gap-2"
      onClick={() => fileRef.current?.click()}
    >
      <Upload className="h-4 w-4 text-gray-400" />
      {fileName ? <span className="text-sm font-medium text-orange-600">{fileName}</span> : <span className="text-sm text-gray-500">Upload updated CSV</span>}
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onChange} disabled={uploading} />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function UploadResultDisplay({ result, colHeaders, renderRow }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: { success: number; failed: number; failedRows: any[]; fatalError?: string }
  colHeaders: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderRow: (r: any) => (string | undefined)[]
}) {
  return (
    <div className="space-y-3">
      {result.fatalError ? (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span><strong>Import failed:</strong> {result.fatalError}</span>
        </div>
      ) : (
        <div className="flex items-center gap-4 text-sm">
          <p className="flex items-center gap-1.5 text-green-600"><CheckCircle2 className="h-4 w-4" /> {result.success} updated</p>
          {result.failed > 0 && <p className="flex items-center gap-1.5 text-red-600"><XCircle className="h-4 w-4" /> {result.failed} failed</p>}
        </div>
      )}
      {result.failedRows.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-red-50 text-red-700 uppercase tracking-wide">
              <tr>{colHeaders.map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {result.failedRows.map((r, i) => (
                <tr key={i} className="bg-white">
                  {renderRow(r).map((v, j) => (
                    <td key={j} className={`px-3 py-2 ${j === colHeaders.length - 1 ? 'text-red-600' : j === colHeaders.length - 2 ? 'font-mono text-gray-400 text-[10px]' : 'text-gray-700'}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Page root ───────────────────────────────────────────────────────────────

export function PillarProgressExportClient() {
  const months = monthOptions()
  const [month, setMonth] = useState(currentMonth())

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Month</p>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <KrProgressCard month={month} />
      <MonthlyInputsCard month={month} />
    </div>
  )
}
