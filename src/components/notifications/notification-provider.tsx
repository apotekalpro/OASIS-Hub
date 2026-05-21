'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotificationStore } from '@/store/notifications'
import { useAuthStore } from '@/store/auth'
import { toast } from 'sonner'
import type { AppNotification } from '@/types/database'

// Single AudioContext reused across calls
let audioCtx: AudioContext | null = null

function getOrCreateAudioContext(): AudioContext | null {
  if (audioCtx && audioCtx.state !== 'closed') return audioCtx
  try {
    audioCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  } catch {
    return null
  }
  return audioCtx
}

async function playTones(freqs: number[], volume: number, noteDuration: number) {
  try {
    const ctx = getOrCreateAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    if (ctx.state !== 'running') return

    const now = ctx.currentTime
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const offset = i * (noteDuration * 0.6)
      gain.gain.setValueAtTime(0, now + offset)
      gain.gain.linearRampToValueAtTime(volume, now + offset + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + noteDuration)
      osc.start(now + offset)
      osc.stop(now + offset + noteDuration + 0.05)
    })
  } catch { /* ignore */ }
}

// Two-tone descending chime for system notifications
function playNotificationSound() {
  playTones([880, 660], 0.18, 0.35)
}

// Single soft ding for new chat messages
function playMessageSound() {
  playTones([1047], 0.12, 0.28)
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore(s => s.profile)
  const { setNotifications, addNotification, setUnreadMessages } = useNotificationStore()
  const initialised = useRef(false)
  const msgChannelIds = useRef<Set<string>>(new Set())
  const msgChannelNames = useRef<Record<string, { name: string; is_direct: boolean }>>({})
  const msgChannelsLoaded = useRef(false)

  // Pre-warm AudioContext on first user gesture (click, keydown, or touch)
  useEffect(() => {
    const warm = () => {
      getOrCreateAudioContext()
      document.removeEventListener('click', warm)
      document.removeEventListener('keydown', warm)
      document.removeEventListener('touchstart', warm)
    }
    document.addEventListener('click', warm, { once: true })
    document.addEventListener('keydown', warm, { once: true })
    document.addEventListener('touchstart', warm, { once: true })
    return () => {
      document.removeEventListener('click', warm)
      document.removeEventListener('keydown', warm)
      document.removeEventListener('touchstart', warm)
    }
  }, [])

  useEffect(() => {
    if (!profile?.id) return

    const supabase = createClient()
    const userId = profile.id

    // Load initial notifications — mark ready even on error so sound works for future ones
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setNotifications(data as AppNotification[])
        initialised.current = true
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

    // ── Global message badge + sound + toast ──────────────────────
    // Fetch channel memberships, cache names, and compute initial unread count.
    supabase
      .from('channel_members')
      .select('channel_id, last_read_at')
      .eq('user_id', userId)
      .then(async ({ data: memberships }) => {
        if (!memberships?.length) return

        const channelIds = memberships.map(m => m.channel_id)
        msgChannelIds.current = new Set(channelIds)

        // Cache channel metadata for toast labels
        const { data: chData } = await supabase
          .from('channels')
          .select('id, name, is_direct')
          .in('id', channelIds)
        ;(chData ?? []).forEach((ch: { id: string; name: string; is_direct: boolean }) => {
          msgChannelNames.current[ch.id] = { name: ch.name, is_direct: ch.is_direct }
        })

        msgChannelsLoaded.current = true

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

    // Subscribe to new messages — update badge, play sound, show toast
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
          const msg = payload.new as {
            channel_id: string
            user_id: string
            content?: string
          }

          if (msg.user_id === userId) return
          if (msgChannelsLoaded.current && !msgChannelIds.current.has(msg.channel_id)) return
          if (useNotificationStore.getState().isMessagesPageMounted) return

          // Update badge
          const { unreadMessages } = useNotificationStore.getState()
          setUnreadMessages(unreadMessages + 1)

          // Play message sound
          playMessageSound()

          // Show toast — look up sender name then display
          const ch = msgChannelNames.current[msg.channel_id]
          supabase
            .from('profiles')
            .select('full_name')
            .eq('id', msg.user_id)
            .single()
            .then(({ data: sender }) => {
              const title = ch?.is_direct
                ? `${sender?.full_name ?? 'New message'}`
                : `#${ch?.name ?? 'New message'}`
              const body = sender?.full_name && !ch?.is_direct
                ? `${sender.full_name}: ${(msg.content ?? '').slice(0, 60)}`
                : (msg.content ?? '').slice(0, 60)
              toast(title, { description: body || undefined, duration: 5000 })
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(notifChannel)
      supabase.removeChannel(msgBadgeChannel)
    }
  }, [profile?.id, setNotifications, addNotification, setUnreadMessages])

  // ── Idle auto-refresh + tab-focus refresh ─────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return

    const supabase = createClient()
    const userId = profile.id
    const IDLE_MS = 15 * 60 * 1000 // 15 minutes

    function isUserTyping() {
      const el = document.activeElement
      return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      )
    }

    async function refreshNotifications() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setNotifications(data as AppNotification[])
    }

    // Idle timer — resets on any user activity; fires if idle for IDLE_MS
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    function resetIdle() {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        if (!isUserTyping()) refreshNotifications()
      }, IDLE_MS)
    }

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const
    activityEvents.forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }))
    resetIdle() // start timer immediately

    // Tab-focus refresh — silently re-fetch whenever user returns to this tab
    function handleVisibility() {
      if (!document.hidden && !isUserTyping()) refreshNotifications()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (idleTimer) clearTimeout(idleTimer)
      activityEvents.forEach(ev => document.removeEventListener(ev, resetIdle))
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [profile?.id, setNotifications])

  return <>{children}</>
}
