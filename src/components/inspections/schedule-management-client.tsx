'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, MoreHorizontal } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const schema = z.object({
  template_id: z.string().min(1, 'Template required'),
  outlet_id: z.string().min(1, 'Outlet required'),
  frequency: z.enum(['once', 'daily', 'weekly', 'fortnightly', 'monthly']),
  scheduled_time: z.string().optional(),
  assigned_to: z.string().optional(),
  starts_at: z.string(),
  is_active: z.boolean(),
})

type FormData = z.infer<typeof schema>

interface ScheduleRow {
  id?: string; frequency: string; scheduled_time: string | null; is_active: boolean; starts_at: string
  template_id?: string; outlet_id?: string; assigned_to?: string | null
}

interface Props {
  orgId: string
  templates: Array<{ id: string; title: string; category: string | null }>
  outlets: Array<{ id: string; name: string; code: string | null }>
  users: Array<{ id: string; full_name: string; email: string; avatar_url: string | null }>
  schedule?: ScheduleRow
  scheduleId?: string
  mode?: 'create' | 'actions'
}

export function ScheduleManagementClient({ orgId, templates, outlets, users, schedule, scheduleId, mode = 'create' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: schedule ? {
      template_id: schedule.template_id ?? '',
      outlet_id: schedule.outlet_id ?? '',
      frequency: schedule.frequency as FormData['frequency'],
      scheduled_time: schedule.scheduled_time ?? '',
      assigned_to: schedule.assigned_to ?? '',
      starts_at: schedule.starts_at,
      is_active: schedule.is_active,
    } : {
      frequency: 'daily',
      starts_at: new Date().toISOString().split('T')[0],
      is_active: true,
    },
  })

  const isActive = watch('is_active')

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const payload = {
      ...data,
      org_id: orgId,
      scheduled_time: data.scheduled_time || null,
      assigned_to: data.assigned_to || null,
    }

    if (scheduleId) {
      const { error } = await supabase.from('inspection_schedules').update(payload).eq('id', scheduleId)
      if (error) { toast.error(error.message); return }
      toast.success('Schedule updated')
    } else {
      const { error } = await supabase.from('inspection_schedules').insert(payload)
      if (error) { toast.error(error.message); return }
      toast.success('Schedule created')
    }
    setOpen(false)
    reset()
    router.refresh()
  }

  async function handleDelete() {
    if (!scheduleId) return
    const supabase = createClient()
    const { error } = await supabase.from('inspection_schedules').delete().eq('id', scheduleId)
    if (error) { toast.error(error.message); return }
    toast.success('Schedule deleted')
    router.refresh()
  }

  const formDialogContent = (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <Dialog.Title className="text-lg font-semibold mb-5">
          {scheduleId ? 'Edit Schedule' : 'New Inspection Schedule'}
        </Dialog.Title>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Template *</label>
            <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('template_id')}>
              <option value="">— Select template —</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.title}{t.category ? ` (${t.category})` : ''}</option>)}
            </select>
            {errors.template_id && <p className="text-xs text-red-500 mt-1">{errors.template_id.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Outlet *</label>
            <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('outlet_id')}>
              <option value="">— Select outlet —</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}{o.code ? ` (${o.code})` : ''}</option>)}
            </select>
            {errors.outlet_id && <p className="text-xs text-red-500 mt-1">{errors.outlet_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('frequency')}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="once">Once</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time (optional)</label>
              <input type="time" className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('scheduled_time')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Starts On</label>
              <input type="date" className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('starts_at')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To (optional)</label>
              <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('assigned_to')}>
                <option value="">— Any staff —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              checked={isActive}
              onChange={e => setValue('is_active', e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700">Active (staff will see this schedule)</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Dialog.Close asChild><Button type="button" variant="outline">Cancel</Button></Dialog.Close>
            <Button type="submit" loading={isSubmitting}>
              {scheduleId ? 'Save Changes' : 'Create Schedule'}
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  )

  if (mode === 'actions') {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="z-50 min-w-[140px] bg-white rounded-lg border border-gray-200 shadow-lg py-1 text-sm" align="end">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 cursor-pointer outline-none">
                  <Edit2 className="h-4 w-4" /> Edit
                </DropdownMenu.Item>
              </Dialog.Trigger>
              {formDialogContent}
            </Dialog.Root>
            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 cursor-pointer outline-none"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> New Schedule</Button>
      </Dialog.Trigger>
      {formDialogContent}
    </Dialog.Root>
  )
}
