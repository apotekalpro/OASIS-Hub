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
  title: z.string().min(2, 'Title required'),
  description: z.string().optional(),
  category: z.string().optional(),
  dept_id: z.string().optional(),
  passing_score: z.string().optional(),
  is_mystery_shopper: z.boolean(),
  is_active: z.boolean(),
})

type FormData = z.infer<typeof schema>

interface TemplateRow {
  id: string; title: string; description: string | null; category: string | null
  is_mystery_shopper: boolean; is_active: boolean; passing_score: number | null
  dept_id?: string | null
}

interface Props {
  orgId: string
  departments: Array<{ id: string; name: string }>
  template?: TemplateRow
  mode?: 'create' | 'actions'
}

export function TemplateListClient({ orgId, departments, template, mode = 'create' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: template ? {
      title: template.title,
      description: template.description ?? '',
      category: template.category ?? '',
      dept_id: template.dept_id ?? '',
      passing_score: template.passing_score?.toString() ?? '',
      is_mystery_shopper: template.is_mystery_shopper,
      is_active: template.is_active,
    } : { title: '', is_mystery_shopper: false, is_active: true },
  })

  const isMystery = watch('is_mystery_shopper')
  const isActive = watch('is_active')

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const payload = {
      title: data.title,
      description: data.description || null,
      category: data.category || null,
      dept_id: data.dept_id || null,
      passing_score: data.passing_score ? parseFloat(data.passing_score) : null,
      is_mystery_shopper: data.is_mystery_shopper,
      is_active: data.is_active,
    }

    if (template?.id) {
      const { error } = await supabase.from('inspection_templates').update(payload).eq('id', template.id)
      if (error) { toast.error(error.message); return }
      toast.success('Template updated')
    } else {
      const { error, data: created } = await supabase
        .from('inspection_templates')
        .insert({ ...payload, org_id: orgId })
        .select('id')
        .single()
      if (error) { toast.error(error.message); return }
      toast.success('Template created — now add sections and questions')
      setOpen(false)
      reset()
      router.push(`/admin/inspection-templates/${(created as { id: string }).id}`)
      return
    }
    setOpen(false)
    reset()
    router.refresh()
  }

  async function handleDelete() {
    if (!template?.id) return
    const supabase = createClient()
    const { error } = await supabase.from('inspection_templates').delete().eq('id', template.id)
    if (error) { toast.error(error.message); return }
    toast.success('Template deleted')
    router.refresh()
  }

  const CATEGORIES = ['Daily Operations', 'Weekly Audit', 'Mystery Shopper', 'FDA Compliance', 'Hygiene & Safety', 'Stock Count', 'VM Check']

  const formDialogContent = (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <Dialog.Title className="text-lg font-semibold mb-5">
          {template ? 'Edit Template' : 'New Inspection Template'}
        </Dialog.Title>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Title *</label>
            <Input placeholder="Daily Pharmacy Operations Checklist" error={errors.title?.message} {...register('title')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Input placeholder="Brief description of what this checklist covers" {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('category')}>
                <option value="">— Select —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('dept_id')}>
                <option value="">— All Depts —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score (%)</label>
              <Input type="number" min="0" max="100" placeholder="80" {...register('passing_score')} />
            </div>
          </div>

          <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                checked={isMystery}
                onChange={e => setValue('is_mystery_shopper', e.target.checked)}
              />
              <span className="text-sm text-gray-700">
                <span className="font-medium">Mystery Shopper</span>
                <span className="text-gray-500 ml-1">— auditor identity hidden from store staff</span>
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                checked={isActive}
                onChange={e => setValue('is_active', e.target.checked)}
              />
              <span className="text-sm font-medium text-gray-700">Active (visible and schedulable)</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button type="submit" loading={isSubmitting}>
              {template ? 'Save Changes' : 'Create & Build'}
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
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="z-50 min-w-[140px] bg-white rounded-lg border border-gray-200 shadow-lg py-1 text-sm" align="end">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 cursor-pointer outline-none">
                  <Edit2 className="h-4 w-4" /> Edit Info
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
        <Button size="sm"><Plus className="h-4 w-4" /> New Template</Button>
      </Dialog.Trigger>
      {formDialogContent}
    </Dialog.Root>
  )
}
