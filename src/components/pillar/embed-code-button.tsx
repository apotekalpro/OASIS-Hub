'use client'

import { useState } from 'react'
import { Code2, Copy, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmbedCodeButton({ token }: { token: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<'url' | 'iframe' | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const embedUrl = `${baseUrl}/embed/pillar-dashboard?token=${token}`
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="800" frameborder="0" style="border:none;border-radius:12px;"></iframe>`

  function copy(text: string, which: 'url' | 'iframe') {
    navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="shrink-0 gap-1.5">
        <Code2 className="h-4 w-4" /> Embed
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Embed Pillar Dashboard</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors"><X className="h-5 w-5" /></button>
            </div>

            <p className="text-sm text-gray-500">
              This link allows anyone who has it to view the dashboard read-only — no login required.
              Keep it private; regenerating requires a <code className="bg-gray-100 px-1 rounded">CRON_SECRET</code> change.
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Direct URL</p>
                <div className="flex items-center gap-2">
                  <input readOnly value={embedUrl} className="flex-1 text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none truncate" />
                  <button onClick={() => copy(embedUrl, 'url')} className="shrink-0 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    {copied === 'url' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-500" />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">iFrame embed code</p>
                <div className="flex items-start gap-2">
                  <textarea readOnly value={iframeCode} rows={3} className="flex-1 text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none resize-none" />
                  <button onClick={() => copy(iframeCode, 'iframe')} className="shrink-0 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors mt-0.5">
                    {copied === 'iframe' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-500" />}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Month navigation works inside the embed — the viewer can switch months without logging in.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
