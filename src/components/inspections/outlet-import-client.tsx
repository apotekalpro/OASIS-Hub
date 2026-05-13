'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Download, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { parseCSV } from '@/lib/utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ParsedRow {
  code: string
  name: string
  address?: string
  city?: string
  state?: string
  phone?: string
  _error?: string
}

interface ImportResult {
  success: number
  skipped: number
  errors: { row: number; name: string; reason: string }[]
}

export function OutletImportClient({ orgId }: { orgId: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)

      // Normalise headers — accept both "Outlet Code"/"code" etc.
      const normalised: ParsedRow[] = parsed.map(row => {
        const get = (...keys: string[]) => {
          for (const k of keys) {
            const found = Object.keys(row).find(h => h.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase().replace(/[\s_-]/g, ''))
            if (found && row[found]?.trim()) return row[found].trim()
          }
          return ''
        }
        const name = get('outletname', 'name', 'storename', 'outlet')
        const code = get('outletcode', 'code', 'storecode', 'id')
        return {
          name,
          code,
          address: get('address', 'addr') || undefined,
          city: get('city', 'town') || undefined,
          state: get('state', 'region') || undefined,
          phone: get('phone', 'tel', 'telephone', 'contact') || undefined,
          _error: !name ? 'Outlet Name is required' : undefined,
        }
      }).filter(r => r.name || r.code)

      setRows(normalised)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!rows.length) return
    setImporting(true)

    const supabase = createClient()
    const valid = rows.filter(r => !r._error)
    const res: ImportResult = { success: 0, skipped: 0, errors: [] }

    for (let i = 0; i < valid.length; i++) {
      const r = valid[i]
      const { error } = await supabase.from('outlets').insert({
        org_id: orgId,
        name: r.name,
        code: r.code || null,
        address: r.address || null,
        city: r.city || null,
        state: r.state || null,
        phone: r.phone || null,
        status: 'active',
      })
      if (error) {
        if (error.code === '23505') {
          res.skipped++
        } else {
          res.errors.push({ row: i + 2, name: r.name, reason: error.message })
        }
      } else {
        res.success++
      }
    }

    setResult(res)
    setImporting(false)
    if (res.success > 0) {
      toast.success(`Imported ${res.success} outlet${res.success > 1 ? 's' : ''}`)
      router.refresh()
    }
  }

  function handleClose(v: boolean) {
    if (!v) {
      setRows([])
      setResult(null)
      setFileName('')
      if (fileRef.current) fileRef.current.value = ''
    }
    setOpen(v)
  }

  function downloadTemplate() {
    const csv = 'Outlet Code,Outlet Name,Address,City,State,Phone\nPJ-001,Alpro Petaling Jaya,123 Jalan ABC,Petaling Jaya,Selangor,+603-12345678\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'outlet-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const validRows = rows.filter(r => !r._error)
  const invalidRows = rows.filter(r => r._error)

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4" /> Import CSV
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-white rounded-xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-semibold mb-1">Import Outlets</Dialog.Title>
          <p className="text-sm text-gray-500 mb-5">
            Upload a CSV file with <strong>Outlet Code</strong> and <strong>Outlet Name</strong> columns.
            Duplicates (same code) will be skipped.
          </p>

          {/* Upload area */}
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            {fileName ? (
              <p className="text-sm font-medium text-indigo-600">{fileName}</p>
            ) : (
              <p className="text-sm text-gray-500">Click to select a CSV file</p>
            )}
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Template download */}
          <button
            onClick={downloadTemplate}
            className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Download template CSV
          </button>

          {/* Preview table */}
          {rows.length > 0 && !result && (
            <div className="mt-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-medium text-gray-700">{rows.length} row{rows.length > 1 ? 's' : ''} detected</span>
                {invalidRows.length > 0 && (
                  <span className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {invalidRows.length} invalid (will be skipped)
                  </span>
                )}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left">Code</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">City</th>
                      <th className="px-3 py-2 text-left w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i} className={cn(r._error && 'bg-red-50')}>
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.code || '—'}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{r.name || <span className="text-red-400 italic">missing</span>}</td>
                        <td className="px-3 py-2 text-gray-500">{r.city || '—'}</td>
                        <td className="px-3 py-2">
                          {r._error
                            ? <span title={r._error}><XCircle className="h-4 w-4 text-red-400" /></span>
                            : <CheckCircle2 className="h-4 w-4 text-green-500" />
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 10 && (
                  <p className="text-xs text-gray-400 text-center py-2">… and {rows.length - 10} more rows</p>
                )}
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.success}</p>
                  <p className="text-xs text-green-600">Imported</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                  <p className="text-xs text-amber-600">Skipped (duplicate)</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
                  <p className="text-xs text-red-600">Failed</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="text-xs text-red-600 space-y-1">
                  {result.errors.map((e, i) => (
                    <p key={i}>Row {e.row}: {e.name} — {e.reason}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center gap-3 mt-6 pt-4 border-t border-gray-100">
            <Dialog.Close asChild>
              <Button variant="outline">{result ? 'Close' : 'Cancel'}</Button>
            </Dialog.Close>
            {!result && (
              <Button
                onClick={handleImport}
                disabled={validRows.length === 0 || importing}
                loading={importing}
              >
                Import {validRows.length > 0 ? `${validRows.length} Outlet${validRows.length > 1 ? 's' : ''}` : ''}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
