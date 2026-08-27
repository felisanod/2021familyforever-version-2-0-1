import { useRef, useState } from 'react'
import { useAuth, phoneToEmail, legacyPhoneToEmail } from '../../contexts/AuthContext'
import { supabase } from '../../types'
import { updateOwnProfile } from '../../services/members'
import { uploadProfilePicture } from '../../services/storage'
import { friendlyError } from '../../utils/errors'
import { formatDate, initialsOf } from '../../utils/format'
import { AccountBadge, RoleBadge } from '../ui/StatusBadge'
import Modal from '../ui/Modal'
import { useToast } from '../ui/Toast'
import { useInstall } from '../../hooks/useInstall'

type Prefs = { ANNOUNCEMENT: boolean; CONTRIBUTION: boolean; PAYMENT: boolean; SYSTEM: boolean }

const PREFS_KEY = 'notification-prefs'

function loadPrefs(): Prefs {
  try {
    return { ANNOUNCEMENT: true, CONTRIBUTION: true, PAYMENT: true, SYSTEM: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return { ANNOUNCEMENT: true, CONTRIBUTION: true, PAYMENT: true, SYSTEM: true }
  }
}

export default function ProfileContent() {
  const { user, refreshUser } = useAuth()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', region: '', city: '' })
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [pushState, setPushState] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )

  // Install app
  const { canUseManualA2HS, isInstalled, install } = useInstall()
  const [installing, setInstalling] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)

  // Password change
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState('')

  if (!user) return null

  const openEdit = () => {
    setForm({ full_name: user.full_name, region: user.region, city: user.city })
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast.showToast('Tafadhali weka jina lako kamili.', 'error')
      return
    }
    setSaving(true)
    const { error } = await updateOwnProfile(user.user_id, {
      full_name: form.full_name.trim(),
      region: form.region.trim(),
      city: form.city.trim(),
      profile_picture: user.profile_picture,
    })
    setSaving(false)
    if (error) {
      toast.showToast(friendlyError(error), 'error')
    } else {
      await refreshUser()
      toast.showToast('Wasifu umesasishwa.')
      setEditOpen(false)
    }
  }

  const handlePicture = async (file: File | undefined) => {
    if (!file || !user) return
    setSaving(true)
    const { url, error } = await uploadProfilePicture(user.user_id, file)
    if (error || !url) {
      toast.showToast(friendlyError(error ?? 'Imeshindikana kupakia faili'), 'error')
    } else {
      await updateOwnProfile(user.user_id, {
        full_name: user.full_name,
        region: user.region,
        city: user.city,
        profile_picture: url,
      })
      await refreshUser()
      toast.showToast('Picha ya wasifu imesasishwa.')
    }
    setSaving(false)
  }

  /** Change password: verify the current one first, then update. */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdError('')
    setPwdSuccess('')
    if (!user) return
    if (pwdNew.length < 6) return setPwdError('Neno jipya la siri linahitaji herufi angalau 6.')
    if (pwdNew !== pwdConfirm) return setPwdError('Maneno ya siri hayalingani.')

    setPwdSaving(true)
    try {
      // Re-authenticate to confirm the current password before changing it.
      // Try the current email convention first, then the legacy one.
      const { error: verifyErr } =
        await supabase.auth.signInWithPassword({ email: phoneToEmail(user.phone_number), password: pwdCurrent }).then(r =>
          r.error ? supabase.auth.signInWithPassword({ email: legacyPhoneToEmail(user.phone_number), password: pwdCurrent }) : r
        )
      if (verifyErr) {
        setPwdSaving(false)
        return setPwdError('Neno la siri la sasa si sahihi.')
      }

      const { error } = await supabase.auth.updateUser({ password: pwdNew })
      setPwdSaving(false)
      if (error) {
        setPwdError(friendlyError(error))
      } else {
        setPwdCurrent('')
        setPwdNew('')
        setPwdConfirm('')
        setPwdSuccess('Neno la siri limebadilishwa kwa mafanikio.')
        toast.showToast('Neno la siri limebadilishwa.')
      }
    } catch {
      setPwdSaving(false)
      setPwdError('Kuna kitu hakifanyi kazi. Tafadhali jaribu tena.')
    }
  }

  /** Triggers the native PWA install dialog and reports the outcome. */
  const handleInstallClick = async () => {
    // Apple does not expose a native, programmable install prompt. The
    // browser's Add to Home Screen action is the only supported route there.
    if (canUseManualA2HS) {
      setShowIosGuide(g => !g)
      return
    }
    setInstalling(true)
    try {
      const outcome = await install()
      if (outcome === 'accepted') {
        toast.showToast('Programu imesakinishwa kwenye simu yako!', 'success')
      } else if (outcome === 'dismissed') {
        toast.showToast('Usakinishaji umesitishwa. Unaweza kujaribu tena wakati wowote.', 'error')
      } else {
        toast.showToast(
          'Kivinjari hakijatoa dirisha la usakinishaji bado. Tumia Chrome/Edge, fungua ukurasa kupitia HTTPS, kisha jaribu tena.',
          'error',
        )
      }
    } catch {
      toast.showToast('Kuna hitilafu imetokea wakati wa usakinishaji. Tafadhali jaribu tena.', 'error')
    } finally {
      setInstalling(false)
    }
  }

  const togglePref = (key: keyof Prefs) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  }

  const enablePush = async () => {
    if (typeof Notification === 'undefined') return
    try {
      const permission = await Notification.requestPermission()
      setPushState(permission)
      if (permission === 'granted') {
        new Notification('2021familyforever', {
          body: 'Arifa zimewashwa kwa kifaa hiki.',
          icon: '/icons/icon-192x192.png',
        })
        toast.showToast('Arifa za push zimewashwa.')
      }
    } catch {
      toast.showToast('Imeshindikana kuwasha arifa kwenye kifaa hiki.', 'error')
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Profile settings */}
      <section className="card p-5 sm:p-6" aria-label="Mpangilio wa wasifu">
        <h2 className="font-semibold text-text mb-4">Mpangilio wa wasifu</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary-50 text-primary flex items-center justify-center overflow-hidden ring-2 ring-primary/15">
              {user.profile_picture ? (
                <img src={user.profile_picture} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold">{initialsOf(user.full_name)}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={saving}
              aria-label="Badilisha picha ya wasifu"
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center border-2 border-surface hover:bg-primary-600"
            >
              ✎
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => handlePicture(e.target.files?.[0])} />
          </div>

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text truncate">{user.full_name}</h1>
            <p className="text-sm text-text-secondary">{user.phone_number}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <RoleBadge role={user.role} />
              <AccountBadge status={user.account_status} />
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border-light text-sm">
          <div>
            <dt className="text-xs text-text-secondary">Namba ya Simu</dt>
            <dd className="font-medium text-text mt-0.5">{user.phone_number}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Mkoa</dt>
            <dd className="font-medium text-text mt-0.5">{user.region || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Mji</dt>
            <dd className="font-medium text-text mt-0.5">{user.city || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Alijiunga</dt>
            <dd className="font-medium text-text mt-0.5">{formatDate(user.created_at)}</dd>
          </div>
        </dl>

        <button className="btn btn-primary btn-sm mt-5" onClick={openEdit}>
          Hariri Wasifu
        </button>
      </section>

      {/* Install + About */}
      <section className="card p-5 sm:p-6 space-y-5" aria-label="Sakinisha na kuhusu programu">
        <div>
          <h2 className="font-semibold text-text">Sakinisha Programu</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            {isInstalled
              ? 'Programu hii imesakinishwa kwenye kifaa chako.'
              : 'Weka 2021familyforever kwenye skrini yako ya nyumbani kwa ufikiaji wa haraka.'}
          </p>
          {isInstalled ? (
            <p className="text-success text-sm mt-3">✓ Imesakinishwa</p>
          ) : (
            <>
              <button
                className="mt-3 w-full py-3.5 px-6 rounded-xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:bg-primary-600 active:scale-[0.98] transition flex items-center justify-center gap-2.5 disabled:opacity-60"
                onClick={handleInstallClick}
                disabled={installing}
              >
                {installing ? (
                  <>
                    <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden />
                    Installing…
                  </>
                ) : (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" y2="3" />
                    </svg>
                    Install
                  </>
                )}
              </button>
              {showIosGuide && canUseManualA2HS && (
                <div className="mt-3 p-4 bg-primary-50 rounded-xl border border-primary/10">
                  <p className="text-xs font-medium text-primary mb-2">Ongeza kwenye Skrini ya Nyumbani (Share → Add to Home Screen):</p>
                  <ol className="list-decimal list-inside text-[11px] text-text-secondary space-y-1">
                    <li>Bonye kwenye menyu ya kivinjari (Share).</li>
                    <li>Chagua “Add to Home Screen”.</li>
                    <li>Thibitisha na “Add”.</li>
                  </ol>
                </div>
              )}
            </>
          )}
        </div>

        <div className="pt-4 border-t border-border-light">
          <h2 className="font-semibold text-text">Kuhusu 2021familyforever</h2>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
            Toleo la 2 — mfumo wa kisasa wa usimamizi wa familia: wanachama, michango,
            malipo na taarifa, vyote katika app moja salama na yenye kufanya kazi hata
            mtandaoni ikiwa haupo.
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-xs text-text-secondary">Toleo</dt>
              <dd className="font-medium text-text">2.0</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-xs text-text-secondary">Developer</dt>
              <dd className="font-medium text-text">felisan∅d</dd>
            </div>
          </dl>
          <p className="text-[11px] text-text-secondary mt-3">
            Imetengenezwa na kudumishwa na felisan∅d.
          </p>
        </div>
      </section>

      {/* Edit profile */}
      <Modal open={editOpen} title="Hariri Wasifu" onClose={() => setEditOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault()
            void handleSave()
          }}
        >
          <div>
            <label className="label" htmlFor="edit-name">Jina Kamili</label>
            <input id="edit-name" className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="edit-region">Mkoa</label>
              <input id="edit-region" className="input" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="edit-city">Mji</label>
              <input id="edit-city" className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setEditOpen(false)} disabled={saving}>
              Ghairi
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Inahifadhi…' : 'Hifadhi Mabadiliko'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Settings */}
      <section className="card p-5 sm:p-6" aria-label="Mpangilio">
        <h2 className="font-semibold text-text">Mpangilio</h2>
        <p className="text-xs text-text-secondary mt-0.5">Arifa — chagua taarifa unazotaka kupokea.</p>

        <div className="mt-4 divide-y divide-border-light">
          {(
            [
              ['ANNOUNCEMENT', 'Taarifa'],
              ['CONTRIBUTION', 'Michango'],
              ['PAYMENT', 'Malipo'],
              ['SYSTEM', 'Ujumbe wa Mfumo'],
            ] as [keyof Prefs, string][]
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between py-3 cursor-pointer">
              <span className="text-sm text-text">{label}</span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={() => togglePref(key)}
                className="w-9 h-5 appearance-none rounded-full bg-border checked:bg-primary relative transition-colors cursor-pointer before:absolute before:top-0.5 before:left-0.5 before:w-4 before:h-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border-light flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-text">Arifa za Push</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {pushState === 'granted'
                ? 'Imewashwa kwenye kifaa hiki.'
                : pushState === 'denied'
                  ? 'Imezuiwa katika Mpangilio ya kivinjari.'
                  : 'Pata arifa hata programu ikiwa imefungwa.'}
            </p>
          </div>
          {pushState !== 'granted' && (
            <button className="btn btn-secondary btn-sm" onClick={enablePush}>
              Washa Arifa
            </button>
          )}
        </div>
      </section>

      {/* Change password */}
      <section className="card p-5 sm:p-6" aria-label="Badilisha neno la siri">
        <h2 className="font-semibold text-text">Badilisha Neno la Siri</h2>
        <p className="text-xs text-text-secondary mt-0.5">Thibitisha neno la siri la sasa, kisha weka jipya.</p>

        <form className="mt-4 space-y-4 max-w-sm" onSubmit={handleChangePassword}>
          <div>
            <label className="label" htmlFor="pwd-current">Neno la Siri la Sasa *</label>
            <input
              id="pwd-current"
              type="password"
              className="input"
              value={pwdCurrent}
              onChange={e => setPwdCurrent(e.target.value)}
              placeholder="Weka neno la siri la sasa"
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label" htmlFor="pwd-new">Neno Jipya la Siri *</label>
            <input
              id="pwd-new"
              type="password"
              className="input"
              value={pwdNew}
              onChange={e => setPwdNew(e.target.value)}
              placeholder="Herufi angalau 6"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label" htmlFor="pwd-confirm">Rudia Neno Jipya la Siri *</label>
            <input
              id="pwd-confirm"
              type="password"
              className="input"
              value={pwdConfirm}
              onChange={e => setPwdConfirm(e.target.value)}
              placeholder="Rudia neno jipya la siri"
              required
              autoComplete="new-password"
            />
          </div>
          {pwdError && <p className="text-error text-sm">{pwdError}</p>}
          {pwdSuccess && <p className="text-success text-sm">✓ {pwdSuccess}</p>}
          <button type="submit" className="btn btn-primary" disabled={pwdSaving}>
            {pwdSaving ? 'Inahifadhi…' : 'Badilisha Neno la Siri'}
          </button>
        </form>
      </section>
    </div>
  )
}
