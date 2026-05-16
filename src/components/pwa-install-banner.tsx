'use client'

import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent
  }
}

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
}

export function PwaInstallBanner() {
  const [installable, setInstallable] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (isInStandaloneMode()) { setInstalled(true); return }
    setIsIos(isIOS())

    if (window.__pwaInstallPrompt) setInstallable(true)
    const handler = () => setInstallable(true)
    window.addEventListener('pwa-installable', handler)

    const appInstalled = () => setInstalled(true)
    window.addEventListener('appinstalled', appInstalled)

    // Check if dismissed in session
    if (sessionStorage.getItem('pwa-banner-dismissed')) setDismissed(true)

    return () => {
      window.removeEventListener('pwa-installable', handler)
      window.removeEventListener('appinstalled', appInstalled)
    }
  }, [])

  async function handleInstall() {
    const prompt = window.__pwaInstallPrompt
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
      window.__pwaInstallPrompt = undefined
    }
  }

  function dismiss() {
    setDismissed(true)
    sessionStorage.setItem('pwa-banner-dismissed', '1')
  }

  if (installed || dismissed) return null
  if (!installable && !isIos) return null

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
      <Smartphone className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-indigo-900">Install OASIS Hub App</p>
        {isIos ? (
          <p className="text-xs text-indigo-700 mt-0.5">
            Tap the Share button <span className="font-mono bg-indigo-100 px-1 rounded">⎙</span> in Safari, then choose <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="text-xs text-indigo-700 mt-0.5">
            Install the app for a faster, offline-ready experience on your device.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!isIos && (
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Install
          </button>
        )}
        <button onClick={dismiss} className="text-indigo-400 hover:text-indigo-600 p-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
