import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useInstall } from '../../hooks/useInstall'

const SEEN_KEY = 'ff-first-login-install-prompt'

/**
 * Install prompt shown ONCE per device, right after the user's first
 * successful login. Dismissing or installing sets a permanent flag so it
 * never interrupts again — the profile page offers install anytime.
 *
 * iOS/iPadOS never fires `beforeinstallprompt`, so the only install path
 * is the browser menu (Share → Add to Home Screen). On those devices we
 * show an inline guide instead of a button that silently no-ops.
 */
export default function InstallPrompt() {
  const { user, loading } = useAuth()
  const { canInstall, canUseManualA2HS, isInstalled, install } = useInstall()
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (loading || !user || isInstalled) return
    // Show guidance when the browser can either prompt natively or via
    // the manual Share menu (iOS).
    if (!canInstall && !canUseManualA2HS) return
    if (localStorage.getItem(SEEN_KEY)) return
    // Short delay so it never interrupts the navigation right after login.
    const t = setTimeout(() => setVisible(true), 1500)
    return () => clearTimeout(t)
  }, [loading, user, canInstall, canUseManualA2HS, isInstalled])

  if (!visible) return null

  const close = () => {
    localStorage.setItem(SEEN_KEY, '1')
    setVisible(false)
  }

  const handleInstall = async () => {
    if (!canInstall) return
    setInstalling(true)
    try {
      const outcome = await install()
      if (outcome === 'accepted' || outcome === 'dismissed') close()
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 left-4 sm:left-auto sm:max-w-xs z-[85]" role="dialog" aria-label="Sakinisha programu">
      <div className="card p-4 shadow-lg border-primary/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">21</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">Sakinisha 2021familyforever</p>
            <p className="text-xs text-text-secondary mt-0.5">Pata ufikiaji wa haraka kutoka skrini yako ya nyumbani.</p>
          </div>
        </div>

        {canUseManualA2HS ? (
          <div className="mt-3">
            <p className="text-xs text-text-secondary mb-3">
              Tumia menyu ya kivinjari (Share → Add to Home Screen) kuongeza programu hapa.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-ghost btn-sm" onClick={close}>Si sasa</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mt-3 justify-end">
            <button className="btn btn-ghost btn-sm" onClick={close}>Si sasa</button>
            <button className="btn btn-primary btn-sm" onClick={handleInstall} disabled={installing}>
              {installing ? 'Installing…' : 'Sakinisha'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
