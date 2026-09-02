import { useCallback, useEffect, useState } from 'react'
import type { Announcement } from '../../types'
import {
  listAnnouncements,
  publishAnnouncement,
  saveDraftAnnouncement,
  publishDraftAnnouncement,
  deleteAnnouncement,
  getAnnouncementStats,
  getAuthorName,
  countActiveMembers,
} from '../../services/announcements'
import { listRegions } from '../../services/members'
import { supabase } from '../../types'
import { uploadAnnouncementImage } from '../../services/storage'
import { formatDate } from '../../utils/format'
import { friendlyError } from '../../utils/errors'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'

type Tab = 'PUBLISHED' | 'DRAFT' | 'EXPIRED'

export default function AdminAnnouncements() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('PUBLISHED')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [authors, setAuthors] = useState<Record<string, string>>({})
  const [statsMap, setStatsMap] = useState<Record<string, { recipients: number; read: number; unread: number; percent: number }>>({})
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [publishTarget, setPublishTarget] = useState<Announcement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { announcements: data } = await listAnnouncements()
    setAnnouncements(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Author names + read statistics
  useEffect(() => {
    if (announcements.length === 0) return
    let cancelled = false

    async function loadMeta() {
      const authorEntries = await Promise.all(
        [...new Set(announcements.map(a => a.created_by))].map(
          async id => [id, await getAuthorName(id)] as const
        )
      )
      const statEntries = await Promise.all(
        announcements
          .filter(a => a.status !== 'DRAFT')
          .map(async a => [a.announcement_id, await getAnnouncementStats(a.announcement_id)] as const)
      )
      if (!cancelled) {
        setAuthors(Object.fromEntries(authorEntries))
        setStatsMap(Object.fromEntries(statEntries))
      }
    }

    void loadMeta()
    return () => {
      cancelled = true
    }
  }, [announcements])

  const filtered = announcements.filter(a => a.status === tab)

  const handlePublishDraft = async () => {
    if (!publishTarget) return
    setActing(true)
    const { recipients, error } = await publishDraftAnnouncement(publishTarget.announcement_id)
    setActing(false)
    if (error) {
      toast.showToast(friendlyError(error), 'error')
    } else {
      toast.showToast(`Taarifa imechapishwa — wanachama ${recipients.toLocaleString()} wamearifiwa.`)
      setPublishTarget(null)
      void load()
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setActing(true)
    const { error } = await deleteAnnouncement(deleteTarget.announcement_id)
    setActing(false)
    if (error) toast.showToast(friendlyError(error), 'error')
    else {
      toast.showToast('Taarifa imefutwa.')
      setDeleteTarget(null)
      void load()
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Taarifa</h1>
          <p className="text-text-secondary text-sm mt-0.5">Tengeneza na chapisha taarifa za 2021familyforever.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          + Tengeneza Taarifa
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2" role="tablist" aria-label="Chuja kwa hali">
        {(['PUBLISHED', 'DRAFT', 'EXPIRED'] as Tab[]).map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`badge border px-4 py-1.5 cursor-pointer transition-colors ${
              tab === t ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border hover:bg-border-light'
            }`}
          >
            {t === 'PUBLISHED' ? 'Zilizochapishwa' : t === 'DRAFT' ? 'Rasimu' : 'Muda Umepita'} ({announcements.filter(a => a.status === t).length})
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === 'DRAFT' ? 'Hakuna rasimu' : tab === 'EXPIRED' ? 'Hakuna taarifa zilizoisha muda' : 'Hakuna taarifa bado'}
          message={tab === 'PUBLISHED' ? 'Taarifa zilizochapishwa zitaonekana hapa.' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const stats = statsMap[a.announcement_id]
            return (
              <article key={a.announcement_id} className="card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-text">{a.title}</h3>
                    <p className="text-sm text-text-secondary line-clamp-2 mt-0.5">{a.message}</p>
                  </div>
                  <span
                    className={`badge border shrink-0 ${
                      a.status === 'PUBLISHED'
                        ? 'bg-success-50 text-success border-success/20'
                        : a.status === 'DRAFT'
                          ? 'bg-warning-50 text-warning border-warning/20'
                          : 'bg-border-light text-text-secondary border-border'
                    }`}
                    >
                      {a.status === 'PUBLISHED' ? 'Imechapishwa' : a.status === 'DRAFT' ? 'Rasimu' : 'Muda Umepita'}
                    </span>
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-border-light text-xs">
                  <div>
                    <dt className="text-text-secondary">Mwandishi</dt>
                    <dd className="font-medium text-text mt-0.5 truncate">{authors[a.created_by] ?? '…'}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">{a.status === 'DRAFT' ? 'Imetengenezwa' : 'Imechapishwa'}</dt>
                    <dd className="font-medium text-text mt-0.5">{formatDate(a.published_at ?? a.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Wahusika</dt>
                    <dd className="font-medium text-text mt-0.5">
                      {a.audience_type === 'ALL'
                        ? 'Wanachama Hai Wote'
                        : a.audience_type === 'REGION'
                          ? `${a.audience_region ?? ''}${a.audience_city ? ` · ${a.audience_city}` : ''}`
                          : 'Waliochaguliwa'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Wapokeaji</dt>
                    <dd className="font-medium text-text mt-0.5">{stats ? stats.recipients.toLocaleString() : '—'}</dd>
                  </div>
                </dl>

                {stats && stats.recipients > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-text-secondary">
                        {stats.read} wamesoma · {stats.unread} hawajasoma
                      </span>
                      <span className="font-semibold text-primary">{stats.percent}% wamesoma</span>
                    </div>
                    <div className="h-1.5 bg-border-light rounded-full overflow-hidden">
                      <div className="h-full bg-success rounded-full" style={{ width: `${stats.percent}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-3 justify-end">
                  {a.status === 'DRAFT' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setPublishTarget(a)}>
                      Chapisha
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm !text-error" onClick={() => setDeleteTarget(a)}>
                    Futa
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      <CreateAnnouncementModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onWALOMALIZA={(message, kind) => {
          setCreateOpen(false)
          toast.showToast(message, kind ?? 'success')
          void load()
        }}
      />

      {/* Publish draft confirmation */}
      <ConfirmDialog
        open={!!publishTarget}
        loading={acting}
        title="Uchapishe Taarifa?"
        message={
          publishTarget && (
            <>
              <strong>{publishTarget.title}</strong> itatumwa kwa{' '}
              {publishTarget.audience_type === 'ALL'
                ? 'wanachama hai wote'
                : publishTarget.audience_type === 'REGION'
                  ? `wanachama wa ${publishTarget.audience_region}`
                  : 'wanachama waliochaguliwa'}{' '}
              na haiwezi kurudishwa kuwa rasimu.
            </>
          )
        }
        confirmLabel="Chapisha"
        onConfirm={handlePublishDraft}
        onCancel={() => setPublishTarget(null)}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        loading={acting}
        danger
        title="Ufute Taarifa?"
        message={deleteTarget?.title}
        confirmLabel="Futa"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

/* ---------------- Create flow ---------------- */

type Step = 'edit' | 'preview'

function CreateAnnouncementModal({
  open,
  onClose,
  onWALOMALIZA,
}: {
  open: boolean
  onClose: () => void
  onWALOMALIZA: (message: string, kind?: 'success' | 'error') => void
}) {
  const [step, setStep] = useState<Step>('edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const [form, setForm] = useState({ title: '', message: '', expiresAt: '' })
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [audienceType, setAudienceType] = useState<'ALL' | 'SELECTED' | 'REGION'>('ALL')
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [regions, setRegions] = useState<string[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [memberOptions, setMemberOptions] = useState<{ user_id: string; full_name: string }[]>([])
  const [recipientCount, setRecipientCount] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setStep('edit')
    setError('')
    setForm({ title: '', message: '', expiresAt: '' })
    setImageUrl(null)
    setAudienceType('ALL')
    setRegion('')
    setCity('')
    setSelectedMembers([])
    setRecipientCount(null)
    void listRegions().then(setRegions)
    void import('../../services/members').then(m =>
      m.listMembers({ pageSize: 500 }).then(({ members }) =>
        setMemberOptions(members.map(x => ({ user_id: x.user_id, full_name: x.full_name })))
      )
    )
  }, [open])

  // Estimate recipients for the preview confirmation summary
  useEffect(() => {
    if (step !== 'preview') return
    let cancelled = false

    async function estimate() {
      if (audienceType === 'ALL') {
        setRecipientCount(await countActiveMembers())
      } else if (audienceType === 'SELECTED') {
        setRecipientCount(selectedMembers.length)
      } else {
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('account_status', 'ACTIVE')
          .ilike('region', region)
        if (!cancelled) setRecipientCount(count ?? 0)
      }
    }

    void estimate()
    return () => {
      cancelled = true
    }
  }, [step, audienceType, selectedMembers.length, region])

  const validate = (): string | null => {
    if (!form.title.trim()) return 'Tafadhali weka kichwa.'
    if (!form.message.trim()) return 'Tafadhali weka ujumbe.'
    if (audienceType === 'REGION' && !region.trim()) return 'Tafadhali chagua mkoa.'
    if (audienceType === 'SELECTED' && selectedMembers.length === 0) return 'Tafadhali chagua angalau mwanachama mmoja.'
    return null
  }

  const handleImage = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    setError('')
    const { url, error: err } = await uploadAnnouncementImage(file)
    setUploading(false)
    if (err || !url) {
      setError(friendlyError(err ?? 'Imeshindikana kupakia faili'))
    } else {
      setImageUrl(url)
    }
  }

  const doSave = async (asDraft: boolean) => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      setStep('edit')
      return
    }

    setSaving(true)
    const payload = {
      title: form.title,
      message: form.message,
      image_url: imageUrl,
      attachment_url: null,
      audience_type: audienceType,
      audience_region: audienceType === 'REGION' ? region : null,
      audience_city: audienceType === 'REGION' ? city || null : null,
      expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      selected_members: audienceType === 'SELECTED' ? selectedMembers : [],
    }

    if (asDraft) {
      const { error: err } = await saveDraftAnnouncement(payload)
      setSaving(false)
      if (err) setError(friendlyError(err))
      else onWALOMALIZA('Rasimu imehifadhiwa.')
      return
    }

    const { result, error: err } = await publishAnnouncement(payload)
    setSaving(false)
    if (err || !result) {
      setError(friendlyError(err))
    } else {
      onWALOMALIZA(`Taarifa imechapishwa — wanachama ${result.recipients.toLocaleString()} wamearifiwa.`)
    }
  }

  return (
    <Modal open={open} title={step === 'edit' ? 'Tengeneza Taarifa' : 'Hakiki & Thibitisha'} onClose={onClose}>
      {step === 'edit' ? (
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault()
            const v = validate()
            if (v) setError(v)
            else {
              setError('')
              setStep('preview')
            }
          }}
        >
          <div>
          <label className="label" htmlFor="a-title">Kichwa *</label>
          <input id="a-title" className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Mkutano wa 2021familyforever" required />
        </div>
        <div>
          <label className="label" htmlFor="a-message">Ujumbe *</label>
          <textarea id="a-message" className="input min-h-[120px]" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Andika taarifa yako…" required />
        </div>

        <fieldset>
          <legend className="label">Wahusika *</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['ALL', 'Wanachama Hai Wote'],
                  ['REGION', 'Mkoa / Mji'],
                  ['SELECTED', 'Waliochaguliwa'],
                ] as ['ALL' | 'REGION' | 'SELECTED', string][]
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setAudienceType(value)}
                  className={`badge border px-3.5 py-1.5 cursor-pointer ${audienceType === value ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {audienceType === 'REGION' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <select className="input" value={region} onChange={e => setRegion(e.target.value)} aria-label="Mkoa">
                  <option value="">Chagua mkoa…</option>
                  {regions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <input className="input" placeholder="Mji (hiari)" value={city} onChange={e => setCity(e.target.value)} aria-label="Mji" />
              </div>
            )}

            {audienceType === 'SELECTED' && (
              <div className="mt-3 border border-border rounded-xl max-h-44 overflow-y-auto divide-y divide-border-light">
                {memberOptions.map(m => (
                  <label key={m.user_id} className="flex items-center gap-3 px-3.5 py-2 cursor-pointer hover:bg-border-light/50">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(m.user_id)}
                      onChange={e =>
                        setSelectedMembers(list =>
                          e.target.checked ? [...list, m.user_id] : list.filter(id => id !== m.user_id)
                        )
                      }
                      className="accent-[var(--color-primary)]"
                    />
                    <span className="text-sm text-text">{m.full_name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="a-expiry">Tarehe ya Kuisha (hiari)</label>
              <input id="a-expiry" className="input" type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="a-image">Picha (hiari)</label>
              <input id="a-image" className="input" type="file" accept="image/*" onChange={e => void handleImage(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          {uploading && <p className="text-xs text-text-secondary">Inapakia picha…</p>}
          {imageUrl && <p className="text-xs text-success">✓ Picha imewekwa</p>}

          {error && <p className="text-error text-sm">{error}</p>}
          <div className="flex justify-end gap-3 pt-2 flex-wrap">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Ghairi</button>
            <button type="button" className="btn btn-ghost" onClick={() => void doSave(true)} disabled={saving || uploading}>
              Hifadhi Kama Rasimu
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || uploading}>Hakiki</button>
          </div>
        </form>
      ) : (
        <div>
          {/* Preview */}
          <article className="card p-4 sm:p-5 mb-4">
            <p className="text-xs font-bold tracking-wider text-secondary uppercase">Hakiki</p>
            <h3 className="font-semibold text-text mt-2">{form.title}</h3>
            <p className="text-sm text-text-secondary mt-1 whitespace-pre-wrap">{form.message}</p>
            {imageUrl && <img src={imageUrl} alt="" className="mt-3 rounded-xl max-h-48 w-full object-cover" />}
          </article>

          {/* Confirmation summary */}
          <section className="rounded-xl bg-primary-50 border border-primary/10 p-4" aria-label="Audience summary">
            <p className="text-xs font-bold tracking-wider text-primary uppercase">Wahusika</p>
            <p className="text-sm font-semibold text-text mt-1">
              {audienceType === 'ALL'
                ? 'Wanachama Hai Wote'
                : audienceType === 'REGION'
                  ? `${region}${city ? ` · ${city}` : ''}`
                  : 'Waliochaguliwa'}
            </p>
            <p className="text-sm text-text-secondary mt-1">
              Wapokeaji: <strong className="text-text">{recipientCount === null ? '…' : recipientCount.toLocaleString()}</strong>
            </p>
          </section>

          {error && <p className="text-error text-sm mt-3">{error}</p>}
          <div className="flex justify-end gap-3 mt-5">
            <button className="btn btn-ghost" onClick={() => setStep('edit')} disabled={saving}>Nyuma</button>
            <button className="btn btn-primary" onClick={() => void doSave(false)} disabled={saving || recipientCount === null}>
              {saving ? 'Inachapishwa…' : 'Chapisha Taarifa'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}