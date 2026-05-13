'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CheckCircle2, XCircle, Clock, Eye } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

type Submission = {
  id: string; status: string; score: number | null; submitted_at: string | null
  created_at: string; reviewer_notes: string | null; reviewed_at: string | null
  submitter: { id: string; full_name: string; avatar_url: string | null } | null
}

const STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'warning' | 'success' | 'destructive'> = {
  draft: 'secondary', submitted: 'default', in_review: 'warning', approved: 'success', rejected: 'destructive',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', in_review: 'In Review', approved: 'Approved', rejected: 'Rejected',
}

const isManager = (role: string) => ['super_admin', 'org_admin', 'dept_head'].includes(role)

interface Props {
  form: { id: string; title: string; description: string | null; fields: object[]; passing_score: number | null; is_active: boolean }
  submissions: Submission[]
  currentUserId: string
  userRole: string
}

export function FormSubmissionsClient({ form, submissions: initial, currentUserId, userRole }: Props) {
  const supabase = createClient()
  const [submissions, setSubmissions] = useState(initial)
  const [reviewing, setReviewing] = useState<Submission | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const stats = {
    total: submissions.length,
    submitted: submissions.filter(s => s.status === 'submitted').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
    avgScore: submissions.filter(s => s.score !== null).length > 0
      ? Math.round(submissions.filter(s => s.score !== null).reduce((a, s) => a + (s.score ?? 0), 0) / submissions.filter(s => s.score !== null).length)
      : null,
  }

  async function review(id: string, decision: 'approved' | 'rejected') {
    setSaving(true)
    const { error } = await supabase.from('form_submissions').update({
      status: decision,
      reviewer_id: currentUserId,
      reviewer_notes: notes.trim() || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)

    if (error) toast.error(error.message)
    else {
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: decision, reviewer_notes: notes.trim() || null } : s))
      toast.success(`Submission ${decision}`)
      setReviewing(null)
      setNotes('')
    }
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/forms" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Forms
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
        {form.description && <p className="text-sm text-gray-500 mt-0.5">{form.description}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900' },
          { label: 'Pending Review', value: stats.submitted, color: 'text-blue-600' },
          { label: 'Approved', value: stats.approved, color: 'text-green-600' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-600' },
          { label: 'Avg Score', value: stats.avgScore !== null ? `${stats.avgScore}%` : '—', color: 'text-gray-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Submissions table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">Submitted By</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Score</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {submissions.map(sub => {
              const passing = sub.score !== null && form.passing_score !== null
                ? sub.score >= form.passing_score
                : null

              return (
                <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    {sub.submitter ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar name={sub.submitter.full_name} avatarUrl={sub.submitter.avatar_url} size="sm" className="w-7 h-7" />
                        <span className="font-medium text-gray-900">{sub.submitter.full_name}</span>
                      </div>
                    ) : <span className="text-gray-400">Unknown</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[sub.status] ?? 'secondary'}>
                      {STATUS_LABEL[sub.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {sub.score !== null ? (
                      <span className={cn('font-medium', passing === true ? 'text-green-600' : passing === false ? 'text-red-600' : 'text-gray-700')}>
                        {sub.score}%
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {sub.submitted_at ? formatDate(sub.submitted_at) : formatDate(sub.created_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/forms/${form.id}/submissions/${sub.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                      </Link>
                      {isManager(userRole) && sub.status === 'submitted' && (
                        <Button
                          size="sm"
                          onClick={() => { setReviewing(sub); setNotes(sub.reviewer_notes ?? '') }}
                        >
                          Review
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {submissions.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">No submissions yet</div>
        )}
      </div>

      {/* Review Dialog */}
      <Dialog.Root open={!!reviewing} onOpenChange={v => { if (!v) { setReviewing(null); setNotes('') } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold">Review Submission</Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </Dialog.Close>
            </div>
            {reviewing && (
              <>
                <p className="text-sm text-gray-600">
                  Reviewing submission from <strong>{reviewing.submitter?.full_name ?? 'Unknown'}</strong>
                  {reviewing.score !== null && <> — Score: <strong>{reviewing.score}%</strong></>}
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer Notes (optional)</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add feedback for the submitter..."
                    className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => review(reviewing.id, 'rejected')}
                    loading={saving}
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => review(reviewing.id, 'approved')}
                    loading={saving}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </Button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
