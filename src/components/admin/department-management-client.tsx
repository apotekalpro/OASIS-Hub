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
import type { Department } from '@/types/database'

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  color: z.string().min(1),
  parent_id: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  departments: Partial<Department>[]
  orgId: string
  dept?: Partial<Department>
  mode?: 'create' | 'actions'
}

export function DepartmentManagementClient({ departments, orgId, dept, mode = 'create' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: dept ? {
      name: dept.name ?? '',
      description: dept.description ?? '',
      color: dept.color ?? '#6366f1',
      parent_id: dept.parent_id ?? '',
    } : { name: '', color: '#6366f1', description: '', parent_id: '' },
  })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const payload = { ...data, parent_id: data.parent_id || null }

    if (dept?.id) {
      const { error } = await supabase.from('departments').update(payload).eq('id', dept.id)
      if (error) { toast.error(error.message); return }
      toast.success('Department updated')
    } else {
      const { error } = await supabase.from('departments').insert({ ...payload, org_id: orgId })
      if (error) { toast.error(error.message); return }
      toast.success('Department created')
    }
    setOpen(false)
    reset()
    router.refresh()
  }

  async function handleDelete() {
    if (!dept?.id) return
    const supabase = createClient()
    const { error } = await supabase.from('departments').delete().eq('id', dept.id)
    if (error) { toast.error(error.message); return }
    toast.success('Department deleted')
    router.refresh()
  }

  const formDialogContent = (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl shadow-xl p-6">
        <Dialog.Title className="text-lg font-semibold mb-4">
          {dept ? 'Edit Department' : 'Create Department'}
        </Dialog.Title>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <Input placeholder="Operations" error={errors.name?.message} {...register('name')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Input placeholder="Optional description" {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input type="color" className="h-9 w-full rounded-md border border-gray-300 p-1 cursor-pointer" {...register('color')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent Department</label>
              <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('parent_id')}>
                <option value="">— Root —</option>
                {departments.filter(d => d.id !== dept?.id).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button type="submit" loading={isSubmitting}>
              {dept ? 'Save Changes' : 'Create Department'}
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
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add Department
        </Button>
      </Dialog.Trigger>
      {formDialogContent}
    </Dialog.Root>
  )
}
