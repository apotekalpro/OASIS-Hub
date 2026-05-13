'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, MoreHorizontal, UserPlus, UserMinus, LogIn } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  color: z.string().min(1),
  dept_id: z.string().optional(),
  is_private: z.boolean(),
})

type FormData = z.infer<typeof schema>

interface TeamRow {
  id: string; name: string; description: string | null; color: string;
  is_private: boolean; created_by: string | null
}

interface Props {
  departments: Array<{ id: string; name: string }>
  orgId: string
  currentUserId: string
  teamId?: string
  team?: TeamRow
  isMember?: boolean
  mode?: 'create' | 'actions'
}

export function TeamsClient({ departments, orgId, currentUserId, teamId, team, isMember, mode = 'create' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: team ? {
      name: team.name,
      description: team.description ?? '',
      color: team.color,
      is_private: team.is_private,
    } : { name: '', color: '#8b5cf6', is_private: false },
  })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    try {
      if (teamId) {
        const { error } = await supabase.from('teams').update(data).eq('id', teamId)
        if (error) throw error
        toast.success('Team updated')
      } else {
        const { error } = await supabase.from('teams').insert({
          ...data,
          org_id: orgId,
          created_by: currentUserId,
        })
        if (error) throw error
        toast.success('Team created! A #general channel was added automatically.')
      }
      setOpen(false)
      reset()
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleDelete() {
    if (!teamId) return
    const supabase = createClient()
    const { error } = await supabase.from('teams').delete().eq('id', teamId)
    if (error) { toast.error(error.message); return }
    toast.success('Team deleted')
    router.refresh()
  }

  async function handleJoin() {
    if (!teamId) return
    const supabase = createClient()
    const { error } = await supabase.from('team_members').insert({ team_id: teamId, user_id: currentUserId, role: 'member' })
    if (error) { toast.error(error.message); return }
    toast.success('Joined team!')
    router.refresh()
  }

  async function handleLeave() {
    if (!teamId) return
    const supabase = createClient()
    const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', currentUserId)
    if (error) { toast.error(error.message); return }
    toast.success('Left team')
    router.refresh()
  }

  const isPrivate = watch('is_private')
  const colorValue = watch('color')

  const FormDialog = () => (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-xl shadow-xl p-6">
        <Dialog.Title className="text-lg font-semibold mb-4">
          {teamId ? 'Edit Team' : 'Create Team'}
        </Dialog.Title>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-3 items-start">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ backgroundColor: colorValue || '#8b5cf6' }}
            >
              {watch('name')?.slice(0, 2).toUpperCase() || 'TM'}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
              <Input placeholder="Operations Alpha" error={errors.name?.message} {...register('name')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Input placeholder="What does this team do?" {...register('description')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('dept_id')}>
                <option value="">— None —</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Color</label>
              <input type="color" className="h-9 w-full rounded-md border border-gray-300 p-1 cursor-pointer" {...register('color')} />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="is_private"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              checked={isPrivate}
              onChange={e => setValue('is_private', e.target.checked)}
            />
            <label htmlFor="is_private" className="text-sm text-gray-700">
              <span className="font-medium">Private team</span>
              <span className="text-gray-500 ml-1">— only visible to members</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button type="submit" loading={isSubmitting}>
              {teamId ? 'Save Changes' : 'Create Team'}
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  )

  if (mode === 'create') {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <Button size="sm"><Plus className="h-4 w-4" /> New Team</Button>
        </Dialog.Trigger>
        <FormDialog />
      </Dialog.Root>
    )
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-[160px] bg-white rounded-lg border border-gray-200 shadow-lg py-1 text-sm" align="end">
          {!isMember ? (
            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-indigo-600 hover:bg-indigo-50 cursor-pointer outline-none"
              onClick={handleJoin}
            >
              <LogIn className="h-4 w-4" /> Join Team
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 cursor-pointer outline-none"
              onClick={handleLeave}
            >
              <UserMinus className="h-4 w-4" /> Leave Team
            </DropdownMenu.Item>
          )}

          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 cursor-pointer outline-none">
                <Edit2 className="h-4 w-4" /> Edit Team
              </DropdownMenu.Item>
            </Dialog.Trigger>
            <FormDialog />
          </Dialog.Root>

          <DropdownMenu.Item
            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 cursor-pointer outline-none"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" /> Delete Team
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
