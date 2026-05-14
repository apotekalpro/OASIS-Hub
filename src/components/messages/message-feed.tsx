'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserAvatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Smile, Trash2, Reply, AtSign } from 'lucide-react'
import { formatRelativeTime, cn } from '@/lib/utils'
import { toast } from 'sonner'

type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }

interface Message {
  id: string
  content: string
  created_at: string
  edited_at: string | null
  parent_id: string | null
  mentions: string[]
  reactions: Record<string, string[]>
  user: { id: string; full_name: string; avatar_url: string | null }
}

interface Props {
  channelId: string
  orgId: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar: string | null
  orgUsers: OrgUser[]
  onNewMessage: (channelId: string) => void
}

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '🎉', '👏']

export function MessageFeed({ channelId, orgId, currentUserId, currentUserName, currentUserAvatar, orgUsers, onNewMessage }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [mentionSearch, setMentionSearch] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mentionUsers = mentionSearch !== null
    ? orgUsers.filter(u => u.full_name.toLowerCase().includes(mentionSearch.toLowerCase())).slice(0, 6)
    : []

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id, content, created_at, edited_at, parent_id, mentions, reactions,
        profiles(id, full_name, avatar_url)
      `)
      .eq('channel_id', channelId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) { toast.error(error.message); setLoading(false); return }

    type RawMsg = {
      id: string; content: string; created_at: string; edited_at: string | null
      parent_id: string | null; mentions: string[]; reactions: Record<string, string[]>
      profiles?: { id: string; full_name: string; avatar_url: string | null } | null
    }

    const msgs = (data as unknown as RawMsg[]).map(m => ({
      id: m.id,
      content: m.content,
      created_at: m.created_at,
      edited_at: m.edited_at,
      parent_id: m.parent_id,
      mentions: m.mentions ?? [],
      reactions: m.reactions ?? {},
      user: m.profiles
        ? { id: m.profiles.id, full_name: m.profiles.full_name, avatar_url: m.profiles.avatar_url }
        : { id: '', full_name: 'Unknown', avatar_url: null },
    }))

    setMessages(msgs)
    setLoading(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [channelId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel(`messages-${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${channelId}`,
      }, async (payload) => {
        const row = payload.new as { id: string; content: string; created_at: string; edited_at: string | null; parent_id: string | null; mentions: string[]; reactions: Record<string, string[]>; user_id: string }
        if (row.parent_id) return // skip thread replies in main feed

        const { data: profile } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', row.user_id).single()
        const p = profile as { id: string; full_name: string; avatar_url: string | null } | null

        const newMsg: Message = {
          id: row.id,
          content: row.content,
          created_at: row.created_at,
          edited_at: row.edited_at,
          parent_id: row.parent_id,
          mentions: row.mentions ?? [],
          reactions: row.reactions ?? {},
          user: p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } : { id: row.user_id, full_name: 'Someone', avatar_url: null },
        }

        setMessages(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        onNewMessage(channelId)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${channelId}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== (payload.old as { id: string }).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [channelId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setText(val)

    // Detect @ mention
    const cursor = e.target.selectionStart
    const textUpToCursor = val.slice(0, cursor)
    const mentionMatch = textUpToCursor.match(/@(\w*)$/)
    if (mentionMatch) {
      setMentionSearch(mentionMatch[1])
      setMentionIndex(0)
    } else {
      setMentionSearch(null)
    }
  }

  function insertMention(user: OrgUser) {
    const cursor = textareaRef.current?.selectionStart ?? text.length
    const textUpToCursor = text.slice(0, cursor)
    const textAfterCursor = text.slice(cursor)
    const newText = textUpToCursor.replace(/@\w*$/, `@${user.full_name} `) + textAfterCursor
    setText(newText)
    setMentionSearch(null)
    textareaRef.current?.focus()
  }

  async function sendMessage() {
    if (!text.trim()) return
    setSending(true)

    // Extract @mentions — find user IDs for mentioned names
    const mentionedIds: string[] = []
    const mentionPattern = /@([^@\n]+?)(?=\s|$)/g
    let match
    while ((match = mentionPattern.exec(text)) !== null) {
      const name = match[1].trim()
      const found = orgUsers.find(u => u.full_name.toLowerCase() === name.toLowerCase())
      if (found) mentionedIds.push(found.id)
    }

    const { error } = await supabase.from('messages').insert({
      channel_id: channelId,
      user_id: currentUserId,
      content: text.trim(),
      parent_id: replyTo?.id ?? null,
      mentions: mentionedIds,
    })

    if (error) toast.error(error.message)
    else {
      // Email mentioned users (fire-and-forget)
      if (mentionedIds.length > 0) {
        const channelRes = await supabase.from('channels').select('name').eq('id', channelId).single()
        fetch('/api/notifications/send-mention-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelId,
            channelName: channelRes.data?.name ?? 'channel',
            userIds: mentionedIds,
            actorName: currentUserName,
            preview: text.trim(),
          }),
        }).catch(() => {})
      }
      setText('')
      setReplyTo(null)
    }
    setSending(false)
  }

  async function deleteMessage(id: string) {
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (error) toast.error(error.message)
  }

  async function toggleReaction(msgId: string, emoji: string) {
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return

    const current = msg.reactions[emoji] ?? []
    const hasReacted = current.includes(currentUserId)
    const updated = hasReacted
      ? { ...msg.reactions, [emoji]: current.filter(id => id !== currentUserId) }
      : { ...msg.reactions, [emoji]: [...current, currentUserId] }

    // Remove empty arrays
    Object.keys(updated).forEach(k => { if (updated[k].length === 0) delete updated[k] })

    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: updated } : m))
    await supabase.from('messages').update({ reactions: updated }).eq('id', msgId)
  }

  // Group messages by date for visual separators
  const grouped: Array<{ date: string; messages: Message[] }> = []
  messages.forEach(msg => {
    const date = new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const last = grouped[grouped.length - 1]
    if (last?.date === date) last.messages.push(msg)
    else grouped.push({ date, messages: [msg] })
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-4">
              <hr className="flex-1 border-gray-100" />
              <span className="text-xs text-gray-400 font-medium">{group.date}</span>
              <hr className="flex-1 border-gray-100" />
            </div>

            {group.messages.map((msg, i) => {
              const prevMsg = i > 0 ? group.messages[i - 1] : null
              const isSameUser = prevMsg?.user.id === msg.user.id
              const timeDiff = prevMsg
                ? (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) / 60000
                : 999
              const compact = isSameUser && timeDiff < 5

              return (
                <div key={msg.id} className={cn('flex gap-3 group hover:bg-gray-50 rounded-lg px-2 py-0.5 -mx-2', compact ? 'mt-0.5' : 'mt-3')}>
                  {compact ? (
                    <div className="w-8 shrink-0 flex items-center justify-center">
                      <span className="text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                        {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ) : (
                    <UserAvatar name={msg.user.full_name} avatarUrl={msg.user.avatar_url} size="sm" className="w-8 h-8 shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 min-w-0">
                    {!compact && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-gray-900">{msg.user.full_name}</span>
                        <span className="text-xs text-gray-400">{formatRelativeTime(msg.created_at)}</span>
                      </div>
                    )}

                    <p className={cn('text-sm text-gray-800 whitespace-pre-wrap break-words', !compact && 'mt-0.5')}>
                      {renderContent(msg.content, orgUsers)}
                    </p>

                    {/* Reactions */}
                    {Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className={cn(
                              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-all',
                              userIds.includes(currentUserId)
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                            )}
                          >
                            {emoji} {userIds.length}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {/* Emoji reaction picker */}
                    <div className="relative group/emoji">
                      <button className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">
                        <Smile className="h-4 w-4" />
                      </button>
                      <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 flex gap-1 hidden group-hover/emoji:flex z-10">
                        {EMOJI_LIST.map(emoji => (
                          <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="hover:scale-125 transition-transform text-base">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button onClick={() => setReplyTo(msg)} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">
                      <Reply className="h-4 w-4" />
                    </button>

                    {msg.user.id === currentUserId && (
                      <button onClick={() => deleteMessage(msg.id)} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-5 py-4 border-t border-gray-100 shrink-0">
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-indigo-50 rounded-lg text-sm">
            <Reply className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="text-gray-600">Replying to <strong>{replyTo.user.full_name}</strong>: {replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? '…' : ''}</span>
            <button onClick={() => setReplyTo(null)} className="ml-auto text-gray-400 hover:text-gray-600">×</button>
          </div>
        )}

        {/* @mention dropdown */}
        {mentionSearch !== null && mentionUsers.length > 0 && (
          <div className="mb-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {mentionUsers.map((u, idx) => (
              <button
                key={u.id}
                onClick={() => insertMention(u)}
                className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50', idx === mentionIndex && 'bg-indigo-50')}
              >
                <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6" />
                <span className="font-medium">{u.full_name}</span>
                <span className="text-gray-400 text-xs ml-auto">{u.email}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={e => {
                if (mentionSearch !== null && mentionUsers.length > 0) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionUsers.length - 1)) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)) }
                  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionUsers[mentionIndex]) }
                  if (e.key === 'Escape') setMentionSearch(null)
                  return
                }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              placeholder="Message... (@ to mention, Enter to send)"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-32 overflow-y-auto"
              style={{ minHeight: '42px' }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 128) + 'px'
              }}
            />
          </div>
          <Button size="sm" onClick={sendMessage} loading={sending} disabled={!text.trim()} className="shrink-0">
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

function renderContent(content: string, users: OrgUser[]) {
  const parts = content.split(/(@[\w\s]+?)(?=\s|$|[^a-zA-Z\s])/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const name = part.slice(1).trim()
      const user = users.find(u => u.full_name.toLowerCase() === name.toLowerCase())
      if (user) {
        return (
          <span key={i} className="text-indigo-600 font-medium bg-indigo-50 rounded px-0.5">{part}</span>
        )
      }
    }
    return part
  })
}
