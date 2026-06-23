'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type Department = { id: string; name: string }

type KRTemplate = {
  id?: string
  title: string
  description?: string | null
  metric_type: string
  start_value: number
  target_value: number
  unit?: string | null
}

type ExistingTemplate = {
  id: string
  title: string
  description: string | null
  dept_id: string | null
  incentive1_amount?: number
  incentive1_basis?: 'per_outlet' | 'per_pax'
  pillar_kr_templates: KRTemplate[]
}

interface Props {
  departments: Department[]
  template?: ExistingTemplate
  trigger: React.ReactNode
  onSaved?: () => void
}

const METRIC_TYPES = ['percentage', 'number', 'boolean', 'currency']

export function PillarTemplateForm({ departments, template, trigger, onSaved }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(template?.title ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [deptId, setDeptId] = useState(template?.dept_id ?? '')
  const [krs, setKrs] = useState<KRTemplate[]>(template?.pillar_kr_templates ?? [])
  const [incentive1Amount, setIncentive1Amount] = useState(template?.incentive1_amount ?? 0)
  const [incentive1Basis, setIncentive1Basis] = useState<'per_outlet' | 'per_pax'>(template?.incentive1_basis ?? 'per_outlet')
  const [saving, setSaving] = useState(false)

  function addKr() {
    setKrs(prev => [...prev, { title: '', metric_type: 'percentage', start_value: 0, target_value: 100, unit: '' }])
  }

  function updateKr(i: number, patch: Partial<KRTemplate>) {
    setKrs(prev => prev.map((kr, idx) => idx === i ? { ...kr, ...patch } : kr))
  }

  function removeKr(i: number) {
    setKrs(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      dept_id: deptId || null,
      keyResults: krs.filter(kr => kr.title.trim()),
      incentive1_amount: Number(incentive1Amount) || 0,
      incentive1_basis: incentive1Basis,
    }
    const res = template
      ? await fetch(`/api/pillar/templates/${template.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/pillar/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    if (res.ok) {
      toast.success(template ? 'Template updated' : 'Template created')
      setOpen(false)
      router.refresh()
      onSaved?.()
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Failed to save template' }))
      toast.error(error ?? 'Failed to save template')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <Dialog.Title className="text-lg font-semibold">{template ? 'Edit Pillar Template' : 'New Pillar Template'}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </Dialog.Close>
          </div>

          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Customer Service Excellence" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="What this pillar is about..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Department (optional)</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option value="">No department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Incentive 1 (paid when this Pillar is completed)</label>
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
                <label className="text-xs font-medium text-gray-500">Key Results</label>
                <button type="button" onClick={addKr} className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add KR
                </button>
              </div>
              {krs.map((kr, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={kr.title}
                      onChange={e => updateKr(i, { title: e.target.value })}
                      placeholder="Key result title"
                      className="flex-1"
                    />
                    <button type="button" onClick={() => removeKr(i)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select value={kr.metric_type} onChange={e => updateKr(i, { metric_type: e.target.value })} className="border border-gray-300 rounded-md px-2 py-1.5 text-xs">
                      {METRIC_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <Input type="number" value={kr.start_value} onChange={e => updateKr(i, { start_value: Number(e.target.value) })} placeholder="Start" className="text-xs" />
                    <Input type="number" value={kr.target_value} onChange={e => updateKr(i, { target_value: Number(e.target.value) })} placeholder="Target" className="text-xs" />
                  </div>
                </div>
              ))}
              {krs.length === 0 && <p className="text-xs text-gray-400">No key results yet — add at least one to track progress.</p>}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
            <Dialog.Close asChild><Button variant="outline">Cancel</Button></Dialog.Close>
            <Button onClick={handleSubmit} loading={saving}>{template ? 'Save' : 'Create'}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
