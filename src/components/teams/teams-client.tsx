'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, MoreHorizontal, UserMinus, LogIn, Search, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/avatar'
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

type OrgUser = { id: string; full_name: string; avatar_url: string | null; email: string }

interface Props {
  departments: Array<{ id: string; name: string }>
  orgUsers: OrgUser[]
  orgId: string
  currentUserId: string
  teamId?: string
  team?: TeamRow
  isMember?: boolean
  mode?: 'create' | 'actions'
}

export function TeamsClient({ departments, orgUsers, orgId, currentUserId, teamId, team, isMember, mode = 'create' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: team ? {
      name: team.name,
      description: team.description ?? '',
      color: team.color,
      is_private: team.is_private,
    } : { name: '', color: '#8b5cf6', is_private: false },
  })

  const isPrivate = watch('is_private')
  const colorValue = watch('color')
  const nameValue = watch('name')

  // Users available to add as members (exclude current user — they're added as leader)
  const availableUsers = orgUsers.filter(u =>
    u.id !== currentUserId &&
    !selectedMemberIds.includes(u.id) &&
    u.full_name.toLowerCase().includes(memberSearch.toLowerCase())
  )
  const selectedUsers = orgUsers.filter(u => selectedMemberIds.includes(u.id))

  function toggleMember(userId: string) {
    setSelectedMemberIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  async function onSubmit(data: FormData) {
    try {
      if (teamId) {
        const res = await fetch(`/api/teams/${teamId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, memberIds: selectedMemberIds }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success(selectedMemberIds.length > 0 ? `Team updated, ${selectedMemberIds.length} member(s) added` : 'Team updated')
        setSelectedMemberIds([])
        setMemberSearch('')
      } else {
        const totalMembers = 1 + selectedMemberIds.length
        const res = await fetch('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, memberIds: selectedMemberIds }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success(`Team created with ${totalMembers} member${totalMembers !== 1 ? 's' : ''}.`)
        setSelectedMemberIds([])
        setMemberSearch('')
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
    const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error((await res.json()).error); return }
    toast.success('Team deleted')
    router.refresh()
  }

  async function handleJoin() {
    if (!teamId) return
    const res = await fetch(`/api/teams/${teamId}/members`, { method: 'POST' })
    if (!res.ok) { toast.error((await res.json()).error); return }
    toast.success('Joined team!')
    router.refresh()
  }

  async function handleLeave() {
    if (!teamId) return
    const res = await fetch(`/api/teams/${teamId}/members`, { method: 'DELETE' })
    if (!res.ok) { toast.error((await res.json()).error); return }
    toast.success('Left team')
    router.refresh()
  }

  const isEditMode = !!teamId

  const formDialogContent = (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl p-6">
        <Dialog.Title className="text-lg font-semibold mb-4">
          {isEditMode ? 'Edit Team' : 'Create New Team'}
        </Dialog.Title>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Team name + colour preview */}
          <div className="flex gap-3 items-start">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ backgroundColor: colorValue || '#8b5cf6' }}
            >
              {nameValue?.slice(0, 2).toUpperCase() || 'TM'}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Colour</label>
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

          {/* Member selector — shown for both create and edit */}
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isEditMode ? 'Add Members' : 'Add Members'}
                {!isEditMode && <span className="text-gray-400 font-normal ml-1">(you&apos;ll be added as Team Leader automatically)</span>}
              </label>

              {/* Selected member chips */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedUsers.map(u => (
                    <span key={u.id} className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 bg-indigo-50 border border-indigo-200 rounded-full text-xs text-indigo-700">
                      <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-4 h-4" />
                      {u.full_name.split(' ')[0]}
                      <button type="button" onClick={() => toggleMember(u.id)} className="ml-0.5 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search people to add…"
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* User list */}
              {memberSearch && (
                <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                  {availableUsers.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">No users found</p>
                  ) : (
                    availableUsers.slice(0, 8).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { toggleMember(u.id); setMemberSearch('') }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50 transition-colors text-left"
                      >
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{u.full_name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                        <Plus className="h-4 w-4 text-indigo-500 shrink-0 ml-auto" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

          <div className="flex justify-end gap-3 pt-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline" onClick={() => { setSelectedMemberIds([]); setMemberSearch('') }}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button type="submit" loading={isSubmitting}>
              {isEditMode ? 'Save Changes' : 'Create Team'}
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  )

  if (mode === 'create') {
    return (
      <Dialog.Root open={open} onOpenChange={v => { setOpen(v); if (!v) { setSelectedMemberIds([]); setMemberSearch('') } }}>
        <Dialog.Trigger asChild>
          <Button size="sm"><Plus className="h-4 w-4" /> New Team</Button>
        </Dialog.Trigger>
        {formDialogContent}
      </Dialog.Root>
    )
  }

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

            {/* Trigger dialog via state — NOT nested Dialog.Trigger inside DropdownMenu */}
            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 cursor-pointer outline-none"
              onSelect={e => { e.preventDefault(); setOpen(true) }}
            >
              <Edit2 className="h-4 w-4" /> Edit Team
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 cursor-pointer outline-none"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" /> Delete Team
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Dialog lives outside DropdownMenu — opens instantly via state */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        {formDialogContent}
      </Dialog.Root>
    </>
  )
}
