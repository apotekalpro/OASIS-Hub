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
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  dept_id: z.string().optional(),
  area_manager_id: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']),
})

type FormData = z.infer<typeof schema>

interface OutletRow {
  id: string; name: string; code: string | null; address: string | null
  city: string | null; state: string | null; phone: string | null
  status: string; area_manager_id: string | null; dept_id?: string | null
}

interface Props {
  orgId: string
  departments: Array<{ id: string; name: string }>
  users: Array<{ id: string; full_name: string; email: string; avatar_url: string | null }>
  outlet?: OutletRow
  mode?: 'create' | 'actions'
}

export function OutletManagementClient({ orgId, departments, users, outlet, mode = 'create' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: outlet ? {
      name: outlet.name,
      code: outlet.code ?? '',
      address: outlet.address ?? '',
      city: outlet.city ?? '',
      state: outlet.state ?? '',
      phone: outlet.phone ?? '',
      dept_id: outlet.dept_id ?? '59ba1694-ff64-4fb6-899e-602b0e3ef10c',
      area_manager_id: outlet.area_manager_id ?? '',
      status: outlet.status as FormData['status'],
    } : { name: '', code: '', address: '', city: '', state: '', phone: '', dept_id: '59ba1694-ff64-4fb6-899e-602b0e3ef10c', status: 'active' },
  })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const payload = {
      ...data,
      dept_id: data.dept_id || null,
      area_manager_id: data.area_manager_id || null,
      code: data.code || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      phone: data.phone || null,
    }

    if (outlet?.id) {
      const { error } = await supabase.from('outlets').update(payload).eq('id', outlet.id)
      if (error) { toast.error(error.message); return }
      toast.success('Outlet updated')
    } else {
      const { error } = await supabase.from('outlets').insert({ ...payload, org_id: orgId })
      if (error) { toast.error(error.message); return }
      toast.success('Outlet created')
    }
    setOpen(false)
    reset()
    router.refresh()
  }

  async function handleDelete() {
    if (!outlet?.id) return
    const supabase = createClient()
    const { error } = await supabase.from('outlets').delete().eq('id', outlet.id)
    if (error) { toast.error(error.message); return }
    toast.success('Outlet deleted')
    router.refresh()
  }

  const formDialogContent = (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <Dialog.Title className="text-lg font-semibold mb-5">
          {outlet ? 'Edit Outlet' : 'Add Outlet'}
        </Dialog.Title>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Outlet Name *</label>
              <Input placeholder="Alpro Petaling Jaya" error={errors.name?.message} {...register('name')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Outlet Code</label>
              <Input placeholder="PJ-001" {...register('code')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input placeholder="+603-xxxx-xxxx" {...register('phone')} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <Input placeholder="123, Jalan ABC" {...register('address')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <Input placeholder="Petaling Jaya" {...register('city')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <Input placeholder="Selangor" {...register('state')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('dept_id')}>
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Area Manager</label>
              <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('area_manager_id')}>
                <option value="">— None —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button type="submit" loading={isSubmitting}>
              {outlet ? 'Save Changes' : 'Create Outlet'}
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
        <Button size="sm"><Plus className="h-4 w-4" /> Add Outlet</Button>
      </Dialog.Trigger>
      {formDialogContent}
    </Dialog.Root>
  )
}
