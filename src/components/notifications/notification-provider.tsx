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
  const { setNotifications, addNotification } = useNotificationStore()
  const initialised = useRef(false)

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

    // Load initial notifications
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          setNotifications(data as AppNotification[])
          initialised.current = true
        }
      })

    // Subscribe to real-time new notifications
    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, setNotifications, addNotification])

  return <>{children}</>
}
