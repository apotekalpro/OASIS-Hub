'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotificationStore } from '@/store/notifications'
import { useAuthStore } from '@/store/auth'
import { toast } from 'sonner'
import type { AppNotification } from '@/types/database'

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const now = ctx.currentTime

    // Two-tone chime: high note then slightly lower
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
  } catch {
    // AudioContext not available (SSR or browser restriction)
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore(s => s.profile)
  const { setNotifications, addNotification } = useNotificationStore()
  const initialised = useRef(false)

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

          // Play chime + show toast
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
