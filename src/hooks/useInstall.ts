import { useCallback, useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

/**
 * Shared PWA install state. Captures the browser's `beforeinstallprompt`
 * event once (module-level singleton) so every consumer — the first-login
 * prompt and the profile card — shares the same pending install request.
 */
let deferredPrompt: BeforeInstallPromptEvent | null = null
// A click can happen while Chrome is still evaluating installability. Keep the
// request alive so the native dialog opens as soon as the event arrives.
let wantsInstall = false
const listeners = new Set<() => void>()
const pendingInstallRequests: Array<(outcome: InstallOutcome) => void> = []

function notify() {
  listeners.forEach(l => l())
}

function settlePending(outcome: InstallOutcome) {
  wantsInstall = false
  while (pendingInstallRequests.length) pendingInstallRequests.shift()!(outcome)
}

async function promptNow(): Promise<InstallOutcome> {
  const event = deferredPrompt
  if (!event) return 'unavailable'

  // A BeforeInstallPromptEvent can only be used once, so clear it before
  // invoking prompt() regardless of the user's choice.
  deferredPrompt = null
  try {
    await event.prompt()
    const { outcome } = await event.userChoice
    notify()
    return outcome
  } catch {
    notify()
    return 'unavailable'
  }
}

/** True on iOS/iPadOS Safari, which never fires `beforeinstallprompt`. */
function isIOS() {
  if (typeof window === 'undefined') return false
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true
  // iPadOS 13+ reports as a Mac with touch support.
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints >= 1) return true
  return false
}

/** True on handheld devices (iOS + Android) for layout/behavior hints. */
function isMobile() {
  if (typeof window === 'undefined') return false
  return isIOS() || /Android|iPhone|iPad|iPod|Mobile/.test(navigator.userAgent)
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
    if (wantsInstall) {
      void promptNow().then(outcome => {
        settlePending(outcome)
        notify()
      })
    }
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    settlePending('accepted')
    notify()
  })
}

export function useInstall() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const listener = () => setTick(t => t + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const isInstalled =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true)

  const canInstall = !!deferredPrompt
  // iOS/iPadOS never gets a `beforeinstallprompt` event — the only install
  // path is the browser menu (Share → Add to Home Screen).
  const canUseManualA2HS = isIOS() && !isInstalled
  const mobile = isMobile()
  // Whether the device can install via *any* supported path.
  const installable = canInstall || canUseManualA2HS

  /** Triggers Chrome/Android's native install dialog when the browser supports it. */
  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (isInstalled) return 'accepted'
    if (deferredPrompt) return promptNow()

    // Usually the event has already fired. On slower phones, however, the
    // user can tap first; wait for it instead of reporting a false failure.
    wantsInstall = true
    return new Promise<InstallOutcome>(resolve => {
      pendingInstallRequests.push(resolve)
      window.setTimeout(() => {
        const index = pendingInstallRequests.indexOf(resolve)
        if (index === -1) return
        pendingInstallRequests.splice(index, 1)
        if (pendingInstallRequests.length === 0) wantsInstall = false
        resolve('unavailable')
      }, 10000)
    })
  }, [isInstalled])

  return { canInstall, canUseManualA2HS, installable, mobile, isInstalled, install }
}
