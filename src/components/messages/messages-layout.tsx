'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useNotificationStore } from '@/store/notifications'
import { ChannelSidebar } from './channel-sidebar'
import { MessageFeed } from './message-feed'
import { ChannelMembersDialog } from './channel-members-dialog'
import { UserAvatar } from '@/components/ui/avatar'
import { ArrowLeft, Hash, Lock, MessageCircle, Users } from 'lucide-react'
import { toast } from 'sonner'

export type Channel = {
  id: string; name: string; description: string | null
  is_private: boolean; is_direct: boolean
  team_id: string | null; dept_id: string | null; created_at: string
  channel_members?: Array<{ user_id: string; last_read_at: string }>
  otherUser?: OrgUser
}

export type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null; dept_id: string | null; role: string }

interface Props {
  channels: Channel[]
  orgUsers: OrgUser[]
  departments: Array<{ id: string; name: string }>
  orgId: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar: string | null
  initialUnreadCounts: Record<string, number>
}

export function MessagesLayout({ channels: initialChannels, orgUsers, departments, orgId, currentUserId, currentUserName, currentUserAvatar, initialUnreadCounts }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [channels, setChannels] = useState<Channel[]>(initialChannels)
  const [activeChannelId, setActiveChannelId] = useState<string | null>(initialChannels[0]?.id ?? null)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(initialUnreadCounts)
  const setUnreadMessages = useNotificationStore(s => s.setUnreadMessages)

  // Keep sidebar Messages badge in sync
  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((s, n) => s + n, 0)
    setUnreadMessages(total)
    return () => setUnreadMessages(0)
  }, [unreadCounts, setUnreadMessages])

  const activeChannel = channels.find(c => c.id === activeChannelId) ?? null
  // Mobile: track whether the feed is open (true) or sidebar is shown (false)
  const [mobileFeedOpen, setMobileFeedOpen] = useState(false)

  async function startDM(otherUser: OrgUser) {
    const { data, error } = await supabase.rpc('get_or_create_dm', { p_other_user_id: otherUser.id })
    if (error) { toast.error(error.message); return }
    const channelId = data as string

    // Check if already in list
    const existing = channels.find(c => c.id === channelId)
    if (!existing) {
      const dmChannel: Channel = {
        id: channelId,
        name: otherUser.full_name,
        description: null,
        is_private: true,
        is_direct: true,
        team_id: null,
        dept_id: null,
        created_at: new Date().toISOString(),
        otherUser,
      }
      setChannels(prev => [...prev, dmChannel])
    }
    setActiveChannelId(channelId)
  }

  function markRead(channelId: string) {
    setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }))
    supabase.rpc('mark_channel_read', { p_channel_id: channelId }).then(() => {})
  }

  function handleChannelSelect(id: string) {
    setActiveChannelId(id)
    markRead(id)
    setMobileFeedOpen(true)
  }

  function onNewMessage(channelId: string) {
    if (channelId !== activeChannelId) {
      setUnreadCounts(prev => ({ ...prev, [channelId]: (prev[channelId] ?? 0) + 1 }))
    }
  }

  const channelHeader = activeChannel ? (
    <div className="flex items-center gap-2 w-full">
      {/* Back button — mobile only */}
      <button
        onClick={() => setMobileFeedOpen(false)}
        className="md:hidden p-1.5 -ml-1 text-gray-400 hover:text-gray-600 shrink-0"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {activeChannel.is_direct ? (
          <>
            <UserAvatar
              name={activeChannel.otherUser?.full_name ?? activeChannel.name}
              avatarUrl={activeChannel.otherUser?.avatar_url ?? null}
              size="sm"
              className="w-7 h-7"
            />
            <span className="font-semibold text-gray-900 truncate">
              {activeChannel.otherUser?.full_name ?? activeChannel.name}
            </span>
          </>
        ) : (
          <>
            {activeChannel.is_private ? <Lock className="h-4 w-4 text-gray-400 shrink-0" /> : <Hash className="h-4 w-4 text-gray-400 shrink-0" />}
            <span className="font-semibold text-gray-900 truncate">{activeChannel.name}</span>
            {activeChannel.description && (
              <span className="hidden sm:block text-sm text-gray-400 font-normal border-l border-gray-200 pl-3 truncate">{activeChannel.description}</span>
            )}
          </>
        )}
      </div>
      {!activeChannel.is_direct && (
        <ChannelMembersDialog
          channelId={activeChannel.id}
          channelName={activeChannel.name}
          orgUsers={orgUsers}
          departments={departments}
          currentUserId={currentUserId}
        />
      )}
    </div>
  ) : null

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Sidebar: always visible on desktop, hidden on mobile when feed is open */}
      <div className={`${mobileFeedOpen ? 'hidden' : 'flex'} md:flex w-full md:w-64 shrink-0`}>
        <ChannelSidebar
          channels={channels}
          orgUsers={orgUsers}
          orgId={orgId}
          currentUserId={currentUserId}
          activeChannelId={activeChannelId}
          unreadCounts={unreadCounts}
          onSelect={handleChannelSelect}
          onStartDM={(user) => { startDM(user) }}
          onChannelCreated={(ch) => {
            setChannels(prev => [...prev, ch])
            setActiveChannelId(ch.id)
            setMobileFeedOpen(true)
          }}
        />
      </div>

      {/* Feed: always visible on desktop, only when mobileFeedOpen on mobile */}
      <div className={`${mobileFeedOpen ? 'flex' : 'hidden'} md:flex flex-1 flex-col overflow-hidden`}>
        {activeChannel ? (
          <>
            {/* Header */}
            <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-white shrink-0">
              {channelHeader}
            </div>
            {/* Feed */}
            <MessageFeed
              key={activeChannelId}
              channelId={activeChannel.id}
              orgId={orgId}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              currentUserAvatar={currentUserAvatar}
              orgUsers={orgUsers}
              onNewMessage={onNewMessage}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a channel to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
