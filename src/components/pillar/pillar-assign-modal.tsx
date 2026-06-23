'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PillarTargetPicker, type PillarTarget, type PickerOutlet, type PickerPerson } from '@/components/ui/pillar-target-picker'
import { toast } from 'sonner'

type Department = { id: string; name: string }

interface Props {
  templateId: string | null
  defaultTitle?: string
  outlets: PickerOutlet[]
  users: PickerPerson[]
  areaManagers: PickerPerson[]
  departments: Department[]
  trigger: React.ReactNode
}

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

export function PillarAssignModal({ templateId, defaultTitle = '', outlets, users, areaManagers, departments, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState('')
  const [targets, setTargets] = useState<PillarTarget[]>([])
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [incentive1Amount, setIncentive1Amount] = useState(0)
  const [incentive1Basis, setIncentive1Basis] = useState<'per_outlet' | 'per_pax'>('per_outlet')
  const [subtasks, setSubtasks] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const months = useMemo(() => nextMonths(), [])

  function toggleMonth(m: string) {
    setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function addSubtask() {
    setSubtasks(prev => [...prev, ''])
  }

  function updateSubtask(i: number, title: string) {
    setSubtasks(prev => prev.map((s, idx) => idx === i ? title : s))
  }

  function removeSubtask(i: number) {
    setSubtasks(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit() {
    if (!title.trim()) return toast.error('Title is required')
    if (selectedMonths.length === 0) return toast.error('Select at least one month')
    if (targets.length === 0) return toast.error('Select at least one outlet, dept, role, or person')

    setSaving(true)
    const res = await fetch('/api/pillar/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId,
        title: title.trim(),
        description: description.trim() || null,
        months: selectedMonths,
        targets: targets.map(t => 'outlet' in t ? { scopeType: t.scopeType, outletId: t.outlet.id } : { scopeType: t.scopeType, userId: t.user.id }),
        ...(templateId ? {} : {
          incentive1Amount: Number(incentive1Amount) || 0,
          incentive1Basis,
          subtasks: subtasks.filter(s => s.trim()).map(title => ({ title: title.trim() })),
        }),
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(`Assigned to ${targets.length} target${targets.length !== 1 ? 's' : ''} across ${selectedMonths.length} month${selectedMonths.length !== 1 ? 's' : ''}`)
      setOpen(false)
      setTargets([])
      setSelectedMonths([])
      router.refresh()
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Failed to assign' }))
      toast.error(error ?? 'Failed to assign')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-xl bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <Dialog.Title className="text-lg font-semibold">{templateId ? 'Assign Pillar' : 'Create Adhoc Pillar'}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </Dialog.Close>
          </div>

          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
            {!templateId && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q3 Cleanliness Drive" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Incentive 1 (paid when completed)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={incentive1Amount}
                      onChange={e => setIncentive1Amount(Number(e.target.value))}
                      placeholder="Amount (Rp)"
                    />
                    <select
                      value={incentive1Basis}
                      onChange={e => setIncentive1Basis(e.target.value as 'per_outlet' | 'per_pax')}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="per_outlet">Flat per outlet</option>
                      <option value="per_pax">Per staff (x headcount)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-500">Subtasks</label>
                    <button type="button" onClick={addSubtask} className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1">
                      <Plus className="h-3.5 w-3.5" /> Add Subtask
                    </button>
                  </div>
                  {subtasks.map((st, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={st}
                        onChange={e => updateSubtask(i, e.target.value)}
                        placeholder="Subtask title"
                        className="flex-1"
                      />
                      <button type="button" onClick={() => removeSubtask(i)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Months</label>
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

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Assign to</label>
              <PillarTargetPicker
                outlets={outlets}
                users={users}
                areaManagers={areaManagers}
                departments={departments}
                selected={targets}
                onChange={setTargets}
              />
            </div>
          </div>

          <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
            <Dialog.Close asChild><Button variant="outline">Cancel</Button></Dialog.Close>
            <Button onClick={handleSubmit} loading={saving}>Assign</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
