'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Users } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  formId: string
  formTitle: string
  orgId: string
  currentUserId: string
  teams: Array<{ id: string; name: string }>
  trigger?: React.ReactNode
}

export function AssignFormDialog({ formId, formTitle, orgId, currentUserId, teams, trigger }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [assignType, setAssignType] = useState<'user' | 'team'>('team')
  const [teamId, setTeamId] = useState('')
  const [userId, setUserId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceRule, setRecurrenceRule] = useState('weekly')
  const [saving, setSaving] = useState(false)

  async function assign() {
    if (assignType === 'team' && !teamId) { toast.error('Select a team'); return }
    if (assignType === 'user' && !userId.trim()) { toast.error('Enter a user ID'); return }

    setSaving(true)
    const { error } = await supabase.from('form_assignments').insert({
      form_id: formId,
      assigned_to: assignType === 'user' ? userId : null,
      assigned_team: assignType === 'team' ? teamId : null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      is_recurring: isRecurring,
      recurrence_rule: isRecurring ? recurrenceRule : null,
      created_by: currentUserId,
    })

    if (error) toast.error(error.message)
    else {
      toast.success('Form assigned successfully')
      setOpen(false)
      setTeamId(''); setUserId(''); setDueDate('')
    }
    setSaving(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {trigger ?? <Button size="sm" variant="outline"><Users className="h-4 w-4" /> Assign</Button>}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-gray-900">Assign Form</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </Dialog.Close>
          </div>

          <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2 truncate">"{formTitle}"</p>

          <div className="space-y-4">
            {/* Assign to */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
              <div className="flex gap-2">
                {(['team', 'user'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setAssignType(t)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all capitalize ${
                      assignType === t ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 text-gray-600 hover:border-indigo-400'
                    }`}
                  >
                    {t === 'team' ? 'A Team' : 'Individual User'}
                  </button>
                ))}
              </div>
            </div>

            {assignType === 'team' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                <select
                  value={teamId}
                  onChange={e => setTeamId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <Input placeholder="Paste user UUID" value={userId} onChange={e => setUserId(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">You can find user IDs in Admin → Users</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700">Recurring assignment</span>
            </label>

            {isRecurring && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  value={recurrenceRule}
                  onChange={e => setRecurrenceRule(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Dialog.Close asChild><Button variant="outline">Cancel</Button></Dialog.Close>
            <Button onClick={assign} loading={saving}>Assign Form</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
