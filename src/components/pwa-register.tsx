'use client'
import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(reg => reg.update())
        .catch(() => {})
    }

    // If beforeinstallprompt already fired (captured by inline script in <head>),
    // notify any mounted listeners now
    if (window.__pwaInstallReady) {
      window.dispatchEvent(new CustomEvent('pwa-installable'))
    }

    // Handle the case where it fires AFTER hydration
    const handler = (e: Event) => {
      e.preventDefault()
      window.__pwaInstallPrompt = e as BeforeInstallPromptEvent
      window.__pwaInstallReady = true
      window.dispatchEvent(new CustomEvent('pwa-installable'))
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  return null
}

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent
    __pwaInstallReady?: boolean
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
