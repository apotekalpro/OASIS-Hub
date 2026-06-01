'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotificationStore } from '@/store/notifications'
import { useAuthStore } from '@/store/auth'
import { toast } from 'sonner'
import type { AppNotification } from '@/types/database'

// Audio elements — created immediately so they preload; play() is called
// within first user gesture to fully unlock them in strict-autoplay browsers.
let notifAudio: HTMLAudioElement | null = null
let msgAudio: HTMLAudioElement | null = null
let audioReady = false

function initAudio() {
  if (audioReady || typeof window === 'undefined') return
  audioReady = true
  try {
    notifAudio = new Audio('/sounds/notification.wav')
    msgAudio = new Audio('/sounds/message.wav')
    notifAudio.preload = 'auto'
    msgAudio.preload = 'auto'
    notifAudio.volume = 0.6
    msgAudio.volume = 0.45
  } catch { /* ignore */ }
}

function unlockAudio() {
  // Call play() within a user gesture — Chrome/Safari require this to allow
  // future plays outside a gesture. Pause immediately so nothing is audible.
  if (!notifAudio) return
  notifAudio.volume = 0
  notifAudio.play()
    .then(() => { notifAudio?.pause(); if (notifAudio) { notifAudio.currentTime = 0; notifAudio.volume = 0.6 } })
    .catch(() => { if (notifAudio) notifAudio.volume = 0.6 })
  if (msgAudio) msgAudio.load()
}

function playNotificationSound() {
  if (!notifAudio) { initAudio() }
  const audio = notifAudio
  if (!audio) return
  audio.currentTime = 0
  audio.volume = 0.6
  audio.play().catch(() => {})
}

function playMessageSound() {
  if (!msgAudio) { initAudio() }
  const audio = msgAudio
  if (!audio) return
  audio.currentTime = 0
  audio.volume = 0.45
  audio.play().catch(() => {})
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore(s => s.profile)
  const { setNotifications, addNotification, setUnreadMessages } = useNotificationStore()
  const initialised = useRef(false)
  const msgChannelIds = useRef<Set<string>>(new Set())
  const msgChannelNames = useRef<Record<string, { name: string; is_direct: boolean }>>({})
  const msgChannelsLoaded = useRef(false)

  // Create audio elements immediately (preload), then unlock within first gesture
  useEffect(() => {
    initAudio()
    const unlock = () => unlockAudio()
    document.addEventListener('click', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
    document.addEventListener('touchstart', unlock, { once: true })
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('keydown', unlock)
      document.removeEventListener('touchstart', unlock)
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification
          if (updated.is_read) {
            useNotificationStore.getState().markRead(updated.id)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[NotificationProvider] realtime channel error — check REPLICA IDENTITY FULL on notifications table')
        }
      })

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
