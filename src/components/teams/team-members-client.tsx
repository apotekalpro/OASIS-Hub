'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, MoreHorizontal, UserMinus, Crown, MessageSquarePlus } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type NonMember = { id: string; full_name: string; email: string; avatar_url: string | null; job_title: string | null; role: string }

interface Props {
  teamId: string
  nonMembers: NonMember[]
  memberId?: string
  memberName?: string
  memberRole?: string
  currentUserId?: string
  memberUserIds?: string[]
  mode: 'add' | 'member-actions'
}

export function TeamMembersClient({ teamId, nonMembers, memberId, memberName, memberRole, currentUserId, memberUserIds, mode }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [creatingChannel, setCreatingChannel] = useState(false)

  async function addMember(userId: string) {
    setAdding(userId)
    const supabase = createClient()
    const { error } = await supabase.from('team_members').insert({ team_id: teamId, user_id: userId, role: 'member' })
    setAdding(null)
    if (error) { toast.error(error.message); return }
    toast.success('Member added to team and #general channel')
    router.refresh()
  }

  async function removeMember() {
    if (!memberId) return
    const supabase = createClient()
    const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', memberId)
    if (error) { toast.error(error.message); return }
    toast.success(`${memberName} removed from team`)
    router.refresh()
  }

  async function promoteToLeader() {
    if (!memberId) return
    const supabase = createClient()
    const { error } = await supabase.from('team_members').update({ role: 'team_leader' }).eq('team_id', teamId).eq('user_id', memberId)
    if (error) { toast.error(error.message); return }
    toast.success(`${memberName} promoted to Team Leader`)
    router.refresh()
  }

  async function demoteToMember() {
    if (!memberId) return
    const supabase = createClient()
    const { error } = await supabase.from('team_members').update({ role: 'member' }).eq('team_id', teamId).eq('user_id', memberId)
    if (error) { toast.error(error.message); return }
    toast.success(`${memberName} set to Member`)
    router.refresh()
  }

  async function createTeamChannel() {
    if (!currentUserId || !memberUserIds) return
    setCreatingChannel(true)
    const supabase = createClient()
    // Fetch team name
    const { data: team } = await supabase.from('teams').select('name, org_id').eq('id', teamId).single()
    if (!team) { toast.error('Could not load team'); setCreatingChannel(false); return }

    const channelName = team.name.toLowerCase().replace(/\s+/g, '-')
    // Check if channel already exists for this team
    const { data: existing } = await supabase.from('channels').select('id').eq('team_id', teamId).eq('is_direct', false).limit(1)
    if (existing && existing.length > 0) {
      toast.info('A channel for this team already exists in Messages')
      setCreatingChannel(false)
      router.push('/messages')
      return
    }

    const { data: ch, error } = await supabase.from('channels').insert({
      org_id: team.org_id,
      team_id: teamId,
      name: channelName,
      is_private: false,
      is_direct: false,
      created_by: currentUserId,
    }).select('id').single()
    if (error || !ch) { toast.error(error?.message ?? 'Failed to create channel'); setCreatingChannel(false); return }

    // Add all team members
    const allMemberIds = [...new Set([currentUserId, ...memberUserIds])]
    await supabase.from('channel_members').insert(allMemberIds.map(uid => ({ channel_id: ch.id, user_id: uid })))
    toast.success(`#${channelName} channel created with ${allMemberIds.length} members`)
    setCreatingChannel(false)
    router.push('/messages')
  }

  const filtered = nonMembers.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  if (mode === 'member-actions') {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="z-50 min-w-[160px] bg-white rounded-lg border border-gray-200 shadow-lg py-1 text-sm" align="end">
            {memberRole !== 'team_leader' ? (
              <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-indigo-600 hover:bg-indigo-50 cursor-pointer outline-none" onClick={promoteToLeader}>
                <Crown className="h-4 w-4" /> Make Leader
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 cursor-pointer outline-none" onClick={demoteToMember}>
                <UserMinus className="h-4 w-4" /> Demote to Member
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 cursor-pointer outline-none" onClick={removeMember}>
              <UserMinus className="h-4 w-4" /> Remove from Team
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={createTeamChannel}
        loading={creatingChannel}
      >
        <MessageSquarePlus className="h-4 w-4" /> Team Chat
      </Button>
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm"><UserPlus className="h-4 w-4" /> Add Members</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl shadow-xl flex flex-col max-h-[80vh]">
          <div className="p-5 border-b border-gray-100">
            <Dialog.Title className="text-lg font-semibold">Add Members</Dialog.Title>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="mt-3 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">
                {search ? 'No users match your search.' : 'All active users are already in this team.'}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filtered.map(u => (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                    <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addMember(u.id)}
                      loading={adding === u.id}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-4 border-t border-gray-100">
            <Dialog.Close asChild>
              <Button variant="outline" className="w-full">Done</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    </div>
  )
}
