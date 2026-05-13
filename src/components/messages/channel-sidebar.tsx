'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Channel, OrgUser } from './messages-layout'
import { UserAvatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Dialog from '@radix-ui/react-dialog'
import { Hash, Lock, Plus, X, Search, MessageSquarePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  channels: Channel[]
  orgUsers: OrgUser[]
  orgId: string
  currentUserId: string
  activeChannelId: string | null
  unreadCounts: Record<string, number>
  onSelect: (id: string) => void
  onStartDM: (user: OrgUser) => void
  onChannelCreated: (ch: Channel) => void
}

export function ChannelSidebar({
  channels, orgUsers, orgId, currentUserId, activeChannelId, unreadCounts, onSelect, onStartDM, onChannelCreated,
}: Props) {
  const supabase = createClient()
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [showNewDM, setShowNewDM] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [channelDesc, setChannelDesc] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [dmSearch, setDmSearch] = useState('')

  const regularChannels = channels.filter(c => !c.is_direct)
  const dmChannels = channels.filter(c => c.is_direct)

  async function createChannel() {
    if (!channelName.trim()) return
    setCreating(true)
    const { data, error } = await supabase.from('channels').insert({
      org_id: orgId,
      name: channelName.trim().toLowerCase().replace(/\s+/g, '-'),
      description: channelDesc.trim() || null,
      is_private: isPrivate,
      is_direct: false,
      created_by: currentUserId,
    }).select('id, name, description, is_private, is_direct, team_id, dept_id, created_at').single()

    if (error) { toast.error(error.message); setCreating(false); return }
    const ch = data as Channel

    // Add creator as member
    const { error: memberError } = await supabase.from('channel_members').insert({ channel_id: ch.id, user_id: currentUserId })
    if (memberError) { toast.error(memberError.message); setCreating(false); return }

    onChannelCreated(ch)
    setChannelName('')
    setChannelDesc('')
    setIsPrivate(false)
    setShowNewChannel(false)
    setCreating(false)
    toast.success(`#${ch.name} created`)
  }

  const filteredDMUsers = orgUsers.filter(u =>
    u.full_name.toLowerCase().includes(dmSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(dmSearch.toLowerCase())
  )

  return (
    <div className="w-64 bg-gray-900 text-gray-100 flex flex-col shrink-0 overflow-hidden">
      <div className="px-4 py-4 border-b border-gray-700">
        <h2 className="font-semibold text-sm text-gray-100">Messages</h2>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Channels section */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-4 py-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Channels</span>
            <button onClick={() => setShowNewChannel(true)} className="text-gray-400 hover:text-gray-200 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {regularChannels.map(ch => (
            <button
              key={ch.id}
              onClick={() => onSelect(ch.id)}
              className={cn(
                'w-full flex items-center gap-2 px-4 py-1.5 text-sm hover:bg-gray-700 transition-colors text-left',
                activeChannelId === ch.id ? 'bg-indigo-600 text-white' : 'text-gray-300'
              )}
            >
              {ch.is_private ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate flex-1">{ch.name}</span>
              {(unreadCounts[ch.id] ?? 0) > 0 && (
                <span className="bg-indigo-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                  {unreadCounts[ch.id]}
                </span>
              )}
            </button>
          ))}
          {regularChannels.length === 0 && (
            <p className="px-4 py-1.5 text-xs text-gray-500">No channels yet</p>
          )}
        </div>

        {/* DMs section */}
        <div>
          <div className="flex items-center justify-between px-4 py-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Direct Messages</span>
            <button onClick={() => setShowNewDM(true)} className="text-gray-400 hover:text-gray-200 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {dmChannels.map(ch => {
            const otherUser = ch.otherUser
            return (
              <button
                key={ch.id}
                onClick={() => onSelect(ch.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-4 py-1.5 text-sm hover:bg-gray-700 transition-colors text-left',
                  activeChannelId === ch.id ? 'bg-indigo-600 text-white' : 'text-gray-300'
                )}
              >
                {otherUser ? (
                  <UserAvatar name={otherUser.full_name} avatarUrl={otherUser.avatar_url} size="sm" className="w-5 h-5 text-xs shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-600 shrink-0" />
                )}
                <span className="truncate flex-1">{otherUser?.full_name ?? ch.name}</span>
                {(unreadCounts[ch.id] ?? 0) > 0 && (
                  <span className="bg-indigo-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                    {unreadCounts[ch.id]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* New Channel Dialog */}
      <Dialog.Root open={showNewChannel} onOpenChange={setShowNewChannel}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold text-gray-900">New Channel</Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </Dialog.Close>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Name</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="e.g. announcements"
                    value={channelName}
                    onChange={e => setChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    className="pl-8"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Input placeholder="What's this channel about?" value={channelDesc} onChange={e => setChannelDesc(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} className="rounded" />
                <span className="text-sm text-gray-700">Make private</span>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <Dialog.Close asChild><Button variant="outline">Cancel</Button></Dialog.Close>
              <Button onClick={createChannel} loading={creating} disabled={!channelName.trim()}>Create Channel</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* New DM Dialog */}
      <Dialog.Root open={showNewDM} onOpenChange={setShowNewDM}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white rounded-xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold text-gray-900">New Message</Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </Dialog.Close>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search people..."
                value={dmSearch}
                onChange={e => setDmSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredDMUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => { onStartDM(u); setShowNewDM(false); setDmSearch('') }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-8 h-8" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                </button>
              ))}
              {filteredDMUsers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No users found</p>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
