'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface SyncResult {
  synced: number
  skipped: number
  total: number
}

export function OutletSyncClient() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    setResult(null)
    try {
      const res = await fetch('/api/outlets/sync-gsheet', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setSyncError(json.error ?? 'Sync failed')
      } else {
        setResult(json)
        toast.success(`Synced ${json.synced} outlet${json.synced !== 1 ? 's' : ''} from Google Sheets`)
        router.refresh()
      }
    } catch {
      setSyncError('Network error — could not reach the server')
    } finally {
      setSyncing(false)
    }
  }

  function handleClose(v: boolean) {
    if (!v) {
      setResult(null)
      setSyncError(null)
    }
    setOpen(v)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4" /> Sync Google Sheets
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl shadow-xl p-6">
          <Dialog.Title className="text-lg font-semibold mb-1">Sync Outlets from Google Sheets</Dialog.Title>
          <p className="text-sm text-gray-500 mb-5">
            Fetches live data from the <strong>Digital Master</strong> sheet and upserts all outlets.
            Existing outlets (matched by code) will be updated; new ones will be added.
          </p>

          <a
            href="https://docs.google.com/spreadsheets/d/1oKBl-ppv5qjsBq8IXj5Q9KPThlSepSG-ocLIdZeS3g0/edit?gid=0#gid=0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline mb-5"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open Google Sheet
          </a>

          {/* Column mapping info */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-0.5 mb-5">
            <p className="font-medium text-gray-700 mb-1">Column mapping (Digital Master sheet)</p>
            <p>B → Outlet Code &nbsp;·&nbsp; C → Store Name &nbsp;·&nbsp; D → Area Manager</p>
            <p>H → Address &nbsp;·&nbsp; J → City &nbsp;·&nbsp; K → Province &nbsp;·&nbsp; L → Postcode</p>
            <p>M → Contact &nbsp;·&nbsp; N → Email &nbsp;·&nbsp; AR → Category</p>
          </div>

          {/* Error state */}
          {syncError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{syncError}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <p className="text-sm font-medium text-gray-900">Sync complete</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.synced}</p>
                  <p className="text-xs text-green-600">Synced</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                  <p className="text-xs text-amber-600">Skipped</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700">{result.total}</p>
                  <p className="text-xs text-gray-500">Total rows</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center gap-3 pt-4 border-t border-gray-100">
            <Dialog.Close asChild>
              <Button variant="outline">{result ? 'Close' : 'Cancel'}</Button>
            </Dialog.Close>
            {!result && (
              <Button onClick={handleSync} disabled={syncing} loading={syncing}>
                {syncing ? 'Syncing…' : 'Sync Now'}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
