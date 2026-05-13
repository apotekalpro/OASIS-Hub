'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, UserCheck, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface IssueRow {
  id: string; title: string; status: string; severity: string
  assigned_to?: string | null
  assignee?: { id: string; full_name: string } | null
}

interface Props {
  issue: IssueRow
  orgUsers: Array<{ id: string; full_name: string; email: string; avatar_url: string | null }>
  currentUserId: string
}

export function IssuesBoardClient({ issue, orgUsers, currentUserId }: Props) {
  const router = useRouter()
  const [resolveOpen, setResolveOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(issue.assignee?.id ?? '')
  const [saving, setSaving] = useState(false)

  async function updateIssue(patch: Record<string, unknown>) {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('inspection_issues').update(patch).eq('id', issue.id)
    setSaving(false)
    if (error) { toast.error(error.message); return false }
    router.refresh()
    return true
  }

  async function handleAssign() {
    const ok = await updateIssue({
      assigned_to: selectedUserId || null,
      status: selectedUserId ? 'in_progress' : 'open',
    })
    if (ok) { toast.success('Issue assigned'); setAssignOpen(false) }
  }

  async function handleResolve() {
    const ok = await updateIssue({
      status: 'resolved',
      resolution_note: resolutionNote || null,
      resolved_by: currentUserId,
      resolved_at: new Date().toISOString(),
    })
    if (ok) { toast.success('Issue resolved'); setResolveOpen(false) }
  }

  async function handleClose() {
    const ok = await updateIssue({ status: 'closed' })
    if (ok) toast.success('Issue closed')
  }

  async function handleEscalate() {
    const ok = await updateIssue({ status: 'escalated' })
    if (ok) toast.success('Issue escalated')
  }

  const isResolved = ['resolved', 'closed'].includes(issue.status)

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="z-50 min-w-[160px] bg-white rounded-lg border border-gray-200 shadow-lg py-1 text-sm" align="end">
            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 cursor-pointer outline-none"
              onClick={() => setAssignOpen(true)}
            >
              <UserCheck className="h-4 w-4" /> Assign
            </DropdownMenu.Item>
            {!isResolved && (
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-green-700 hover:bg-green-50 cursor-pointer outline-none"
                onClick={() => setResolveOpen(true)}
              >
                <CheckCircle2 className="h-4 w-4" /> Resolve
              </DropdownMenu.Item>
            )}
            {!isResolved && (
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-amber-700 hover:bg-amber-50 cursor-pointer outline-none"
                onClick={handleEscalate}
              >
                <AlertTriangle className="h-4 w-4" /> Escalate
              </DropdownMenu.Item>
            )}
            {issue.status === 'resolved' && (
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:bg-gray-50 cursor-pointer outline-none"
                onClick={handleClose}
              >
                <X className="h-4 w-4" /> Close
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Assign Dialog */}
      <Dialog.Root open={assignOpen} onOpenChange={setAssignOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white rounded-xl shadow-xl p-6">
            <Dialog.Title className="text-base font-semibold mb-4">Assign Issue</Dialog.Title>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{issue.title}</p>
            <select
              className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {orgUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <div className="flex justify-end gap-3">
              <Dialog.Close asChild><Button variant="outline" size="sm">Cancel</Button></Dialog.Close>
              <Button size="sm" onClick={handleAssign} loading={saving}>Assign</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Resolve Dialog */}
      <Dialog.Root open={resolveOpen} onOpenChange={setResolveOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white rounded-xl shadow-xl p-6">
            <Dialog.Title className="text-base font-semibold mb-4">Resolve Issue</Dialog.Title>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{issue.title}</p>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-none mb-4"
              placeholder="Describe what action was taken to resolve this issue..."
              value={resolutionNote}
              onChange={e => setResolutionNote(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <Dialog.Close asChild><Button variant="outline" size="sm">Cancel</Button></Dialog.Close>
              <Button size="sm" onClick={handleResolve} loading={saving}>Mark Resolved</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
