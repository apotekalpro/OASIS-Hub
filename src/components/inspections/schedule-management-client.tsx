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
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const ROLE_OPTIONS = [
  { value: 'org_admin', label: 'Org Admin' },
  { value: 'dept_head', label: 'Dept Head' },
  { value: 'lead', label: 'Lead / Supervisor' },
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'member', label: 'Member' },
]

const schema = z.object({
  template_id: z.string().min(1, 'Template required'),
  outlet_scope: z.enum(['specific', 'all', 'assignee_area']),
  outlet_id: z.string().optional(),
  frequency: z.enum(['once', 'daily', 'weekly', 'fortnightly', 'monthly']),
  scheduled_time: z.string().optional(),
  due_hours: z.coerce.number().int().positive().optional().or(z.literal('')),
  assign_type: z.enum(['any', 'user', 'role']),
  assigned_to: z.string().optional(),
  assigned_role: z.string().optional(),
  assigned_dept_id: z.string().optional(),
  starts_at: z.string(),
  is_active: z.boolean(),
}).superRefine((d, ctx) => {
  if (d.outlet_scope === 'specific' && !d.outlet_id) {
    ctx.addIssue({ code: 'custom', path: ['outlet_id'], message: 'Outlet required' })
  }
  if (d.assign_type === 'user' && !d.assigned_to) {
    ctx.addIssue({ code: 'custom', path: ['assigned_to'], message: 'Select a person' })
  }
  if (d.assign_type === 'role' && !d.assigned_role) {
    ctx.addIssue({ code: 'custom', path: ['assigned_role'], message: 'Select a role' })
  }
})

type FormData = z.infer<typeof schema>

interface ScheduleRow {
  id?: string; frequency: string; scheduled_time: string | null; is_active: boolean; starts_at: string
  template_id?: string; outlet_id?: string | null; assigned_to?: string | null
  outlet_scope?: string; assign_type?: string; assigned_role?: string | null; assigned_dept_id?: string | null
  due_hours?: number | null
}

interface Props {
  orgId: string
  templates: Array<{ id: string; title: string; category: string | null }>
  outlets: Array<{ id: string; name: string; code: string | null }>
  users: Array<{ id: string; full_name: string; email: string; avatar_url: string | null }>
  departments: Array<{ id: string; name: string }>
  schedule?: ScheduleRow
  scheduleId?: string
  mode?: 'create' | 'actions'
}

const selectCls = 'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const inputCls = 'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export function ScheduleManagementClient({ orgId, templates, outlets, users, departments, schedule, scheduleId, mode = 'create' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: schedule ? {
      template_id: schedule.template_id ?? '',
      outlet_scope: (schedule.outlet_scope as FormData['outlet_scope']) ?? 'specific',
      outlet_id: schedule.outlet_id ?? '',
      frequency: schedule.frequency as FormData['frequency'],
      scheduled_time: schedule.scheduled_time ?? '',
      due_hours: schedule.due_hours ?? undefined,
      assign_type: (schedule.assign_type as FormData['assign_type']) ?? 'any',
      assigned_to: schedule.assigned_to ?? '',
      assigned_role: schedule.assigned_role ?? '',
      assigned_dept_id: schedule.assigned_dept_id ?? '',
      starts_at: schedule.starts_at,
      is_active: schedule.is_active,
    } : {
      frequency: 'daily',
      outlet_scope: 'specific',
      assign_type: 'any',
      starts_at: new Date().toISOString().split('T')[0],
      is_active: true,
    },
  })

  const outletScope = watch('outlet_scope')
  const assignType = watch('assign_type')
  const isActive = watch('is_active')

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const payload = {
      org_id: orgId,
      template_id: data.template_id,
      outlet_scope: data.outlet_scope,
      outlet_id: data.outlet_scope === 'specific' ? (data.outlet_id || null) : null,
      frequency: data.frequency,
      scheduled_time: data.scheduled_time || null,
      due_hours: data.due_hours || null,
      assign_type: data.assign_type,
      assigned_to: data.assign_type === 'user' ? (data.assigned_to || null) : null,
      assigned_role: data.assign_type === 'role' ? (data.assigned_role || null) : null,
      assigned_dept_id: data.assign_type === 'role' ? (data.assigned_dept_id || null) : null,
      starts_at: data.starts_at,
      is_active: data.is_active,
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Template */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Template *</label>
            <select className={selectCls} {...register('template_id')}>
              <option value="">— Select template —</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.title}{t.category ? ` (${t.category})` : ''}</option>)}
            </select>
            {errors.template_id && <p className="text-xs text-red-500 mt-1">{errors.template_id.message}</p>}
          </div>

          {/* Outlet scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Outlets *</label>
            <select className={selectCls} {...register('outlet_scope')}>
              <option value="specific">Specific Outlet</option>
              <option value="all">All Outlets (Org-wide)</option>
              <option value="assignee_area">Assignee's Area (outlets they manage)</option>
            </select>
            {outletScope === 'specific' && (
              <div className="mt-2">
                <select className={selectCls} {...register('outlet_id')}>
                  <option value="">— Select outlet —</option>
                  {outlets.map(o => <option key={o.id} value={o.id}>{o.name}{o.code ? ` (${o.code})` : ''}</option>)}
                </select>
                {errors.outlet_id && <p className="text-xs text-red-500 mt-1">{errors.outlet_id.message}</p>}
              </div>
            )}
            {outletScope === 'all' && (
              <p className="text-xs text-gray-500 mt-1">This schedule applies to all {outlets.length} outlets.</p>
            )}
            {outletScope === 'assignee_area' && (
              <p className="text-xs text-gray-500 mt-1">Applies to outlets where the assigned person is the area manager.</p>
            )}
          </div>

          {/* Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
            <select className={selectCls} {...register('assign_type')}>
              <option value="any">Any Staff (self-assign)</option>
              <option value="user">Specific Person</option>
              <option value="role">By Role / Department</option>
            </select>

            {assignType === 'user' && (
              <div className="mt-2">
                <select className={selectCls} {...register('assigned_to')}>
                  <option value="">— Select person —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                </select>
                {errors.assigned_to && <p className="text-xs text-red-500 mt-1">{errors.assigned_to.message}</p>}
              </div>
            )}

            {assignType === 'role' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Role</label>
                  <select className={selectCls} {...register('assigned_role')}>
                    <option value="">— Select role —</option>
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  {errors.assigned_role && <p className="text-xs text-red-500 mt-1">{errors.assigned_role.message}</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Department (optional)</label>
                  <select className={selectCls} {...register('assigned_dept_id')}>
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Frequency & timing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select className={selectCls} {...register('frequency')}>
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Time</label>
              <input type="time" className={inputCls} {...register('scheduled_time')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Starts On</label>
              <input type="date" className={inputCls} {...register('starts_at')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Within (hours)</label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 24"
                className={inputCls}
                {...register('due_hours')}
              />
              <p className="text-xs text-gray-400 mt-0.5">Hours to complete after scheduled time</p>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              checked={isActive}
              onChange={e => setValue('is_active', e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700">Active (visible to assigned staff)</span>
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
