'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Upload, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { parseCSV } from '@/lib/utils'
import { toast } from 'sonner'

type Kr = {
  id: string
  title: string
  metric_type: string
  start_value: number
  target_value: number
  current_value: number
  unit: string | null
  status: string
}

type Assignment = {
  id: string
  title: string
  outlets: { name: string; code: string } | null
  pillar_assignment_krs: Kr[]
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

function progressPct(kr: Kr) {
  if (kr.metric_type === 'boolean') return kr.current_value >= 1 ? 100 : 0
  const range = kr.target_value - kr.start_value
  if (range === 0) return 0
  return Math.min(100, Math.max(0, Math.round(((kr.current_value - kr.start_value) / range) * 100)))
}

export function PillarProgressExportClient() {
  const fileRef = useRef<HTMLInputElement>(null)
  const months = monthOptions()
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  const [month, setMonth] = useState(currentMonth)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number } | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/pillar/assignments?month=${month}`)
      .then(r => r.json())
      .then(d => setAssignments(d.assignments ?? []))
      .finally(() => setLoading(false))
  }, [month])

  const krRows = assignments.flatMap(a =>
    (a.pillar_assignment_krs ?? []).map(kr => ({ assignment: a, kr }))
  )

  function downloadCSV() {
    if (krRows.length === 0) return toast.error('No pillar progress to export for this month')
    const header = ['KR ID', 'Outlet Code', 'Outlet Name', 'Pillar', 'Key Result', 'Metric Type', 'Start', 'Target', 'Current Value', 'Unit', 'Status', 'Progress %']
    const lines = krRows.map(({ assignment, kr }) => [
      kr.id,
      assignment.outlets?.code ?? '',
      assignment.outlets?.name ?? '',
      assignment.title,
      kr.title,
      kr.metric_type,
      kr.start_value,
      kr.target_value,
      kr.current_value,
      kr.unit ?? '',
      kr.status,
      progressPct(kr),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pillar-progress-${month.slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setUploadResult(null)
    const reader = new FileReader()
    reader.onload = async ev => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      const get = (row: Record<string, string>, ...keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(row).find(h => h.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase().replace(/[\s_-]/g, ''))
          if (found && row[found]?.trim()) return row[found].trim()
        }
        return ''
      }
      const rows = parsed
        .map(row => ({
          krId: get(row, 'krid', 'kr id'),
          currentValue: Number(get(row, 'currentvalue', 'current value')) || 0,
          status: get(row, 'status').toLowerCase().replace(/\s+/g, '_'),
        }))
        .filter(r => r.krId)

      if (rows.length === 0) { toast.error('No valid rows found — make sure the KR ID column is intact'); return }

      setUploading(true)
      const res = await fetch('/api/pillar/krs/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      setUploading(false)
      if (res.ok) {
        const { successCount, failedCount } = await res.json()
        setUploadResult({ success: successCount ?? 0, failed: failedCount ?? 0 })
        if (failedCount > 0) toast.error(`Updated ${successCount} key results, ${failedCount} failed`)
        else toast.success(`Updated ${successCount} key results`)
        fetch(`/api/pillar/assignments?month=${month}`).then(r => r.json()).then(d => setAssignments(d.assignments ?? []))
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Import failed' }))
        toast.error(error ?? 'Import failed')
      }
    }
    reader.readAsText(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export &amp; Re-import Pillar Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={downloadCSV} disabled={loading || krRows.length === 0}>
              <Download className="h-4 w-4" /> Export Current Progress ({krRows.length} key results)
            </Button>

            <div
              className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-2.5 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-colors flex items-center gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4 text-gray-400" />
              {fileName ? <span className="text-sm font-medium text-orange-600">{fileName}</span> : <span className="text-sm text-gray-500">Upload updated CSV</span>}
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} disabled={uploading} />
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Export the CSV, fill in the &quot;Current Value&quot; (and optionally &quot;Status&quot;) columns for each Key Result, then upload it back here.
            Don&apos;t edit or remove the &quot;KR ID&quot; column — it&apos;s used to match each row back to the correct Key Result. Progress bars and rewards recalculate automatically.
          </p>

          {uploading && <p className="text-xs text-gray-500 animate-pulse">Updating key results…</p>}

          {uploadResult !== null && (
            <div className="flex items-center gap-4 text-sm">
              <p className="flex items-center gap-1.5 text-green-600"><CheckCircle2 className="h-4 w-4" /> {uploadResult.success} updated</p>
              {uploadResult.failed > 0 && (
                <p className="flex items-center gap-1.5 text-red-600"><XCircle className="h-4 w-4" /> {uploadResult.failed} failed</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Preview — {month && new Date(month + 'T00:00:00').toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}</CardTitle></CardHeader>
        <CardContent>
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Outlet</th>
                  <th className="px-3 py-2 text-left">Pillar</th>
                  <th className="px-3 py-2 text-left">Key Result</th>
                  <th className="px-3 py-2 text-right">Current</th>
                  <th className="px-3 py-2 text-right">Target</th>
                  <th className="px-3 py-2 text-right">Progress</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {krRows.map(({ assignment, kr }) => (
                  <tr key={kr.id}>
                    <td className="px-3 py-2 text-gray-800">{assignment.outlets?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{assignment.title}</td>
                    <td className="px-3 py-2 text-gray-600">{kr.title}</td>
                    <td className="px-3 py-2 text-right">{kr.current_value.toLocaleString('id-ID')}{kr.unit ? ` ${kr.unit}` : ''}</td>
                    <td className="px-3 py-2 text-right">{kr.target_value.toLocaleString('id-ID')}{kr.unit ? ` ${kr.unit}` : ''}</td>
                    <td className="px-3 py-2 text-right">{progressPct(kr)}%</td>
                    <td className="px-3 py-2 text-gray-500 capitalize">{kr.status.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
                {!loading && krRows.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400 text-sm">No pillar assignments found for this month</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400 text-sm">Loading…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
