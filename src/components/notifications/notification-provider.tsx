'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotificationStore } from '@/store/notifications'
import { useAuthStore } from '@/store/auth'
import { toast } from 'sonner'
import type { AppNotification } from '@/types/database'

// Pre-warm AudioContext on first user gesture so the browser allows sound
let audioCtx: AudioContext | null = null

function ensureAudioContext() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    } catch { /* not available */ }
  }
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
}

function playNotificationSound() {
  try {
    if (!audioCtx) return
    const ctx = audioCtx
    const now = ctx.currentTime
    const freqs = [880, 660]
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + i * 0.15)
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.15 + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.35)
      osc.start(now + i * 0.15)
      osc.stop(now + i * 0.15 + 0.4)
    })
  } catch { /* ignore */ }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore(s => s.profile)
  const { setNotifications, addNotification, setUnreadMessages } = useNotificationStore()
  const initialised = useRef(false)
  // Track which channels the current user belongs to for message badge counting
  const msgChannelIds = useRef<Set<string>>(new Set())
  const msgChannelsLoaded = useRef(false)

  // Pre-warm AudioContext on first click/keydown anywhere on the page
  useEffect(() => {
    const warm = () => { ensureAudioContext(); document.removeEventListener('click', warm); document.removeEventListener('keydown', warm) }
    document.addEventListener('click', warm, { once: true })
    document.addEventListener('keydown', warm, { once: true })
    return () => { document.removeEventListener('click', warm); document.removeEventListener('keydown', warm) }
  }, [])

  useEffect(() => {
    if (!profile?.id) return

    const supabase = createClient()
    const userId = profile.id

    // Load initial notifications
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          setNotifications(data as AppNotification[])
          initialised.current = true
        }
      })

    // Subscribe to real-time new notifications
    const notifChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as AppNotification
          addNotification(notification)

          if (initialised.current) playNotificationSound()

          toast(notification.title, {
            description: notification.body ?? undefined,
            duration: 6000,
          })
        }
      )
      .subscribe()

    // ── Global message badge tracking ─────────────────────────────
    // Fetch channel memberships + initial unread message counts.
    // This runs globally (not just on the messages page) so the badge
    // stays accurate on every route.
    supabase
      .from('channel_members')
      .select('channel_id, last_read_at')
      .eq('user_id', userId)
      .then(async ({ data: memberships }) => {
        if (!memberships?.length) return

        msgChannelIds.current = new Set(memberships.map(m => m.channel_id))
        msgChannelsLoaded.current = true

        // MessagesLayout manages the count while the messages page is open;
        // only initialise here when the user is elsewhere.
        if (useNotificationStore.getState().isMessagesPageMounted) return

        let total = 0
        for (const m of memberships) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', m.channel_id)
            .neq('user_id', userId)
            .gt('created_at', m.last_read_at ?? '1970-01-01T00:00:00Z')
          total += count ?? 0
        }

        if (!useNotificationStore.getState().isMessagesPageMounted) {
          setUnreadMessages(total)
        }
      })

    // Subscribe to new messages so the badge increments in real-time on any page.
    // Supabase RLS ensures only messages from channels the user can read arrive here.
    const msgBadgeChannel = supabase
      .channel(`msg-badge:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new as { channel_id: string; user_id: string }

          // Ignore own messages
          if (msg.user_id === userId) return

          // Ignore channels this user isn't in (extra safety on top of RLS)
          if (msgChannelsLoaded.current && !msgChannelIds.current.has(msg.channel_id)) return

          // MessagesLayout owns the badge while the messages page is open
          if (useNotificationStore.getState().isMessagesPageMounted) return

          const { unreadMessages } = useNotificationStore.getState()
          setUnreadMessages(unreadMessages + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(notifChannel)
      supabase.removeChannel(msgBadgeChannel)
    }
  }, [profile?.id, setNotifications, addNotification, setUnreadMessages])

  return <>{children}</>
}
