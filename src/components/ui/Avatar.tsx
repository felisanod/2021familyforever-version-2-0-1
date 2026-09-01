import { useEffect, useState } from 'react'

type Props = {
  src?: string | null
  name?: string | null
  className?: string
}

/** Clickable profile avatar — opens a floating card preview when a picture is set. */
export default function Avatar({ src, name, className = 'w-9 h-9 text-xs' }: Props) {
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [preview])

  const initials = name
    ? name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join('')
    : ''

  return (
    <>
      <div
        className={`relative shrink-0 rounded-full bg-primary-50 text-primary font-semibold flex items-center justify-center overflow-hidden ${className} ${
          src ? 'cursor-zoom-in' : ''
        }`}
        onClick={src ? () => setPreview(true) : undefined}
        role={src ? 'button' : undefined}
        tabIndex={src ? 0 : undefined}
        aria-label={src ? 'Onyesha picha ya wasifu' : undefined}
        onKeyDown={src ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreview(true) } } : undefined}
        title={src ? 'Bofya kuona picha' : undefined}
      >
        {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : initials}
      </div>

      {preview && src && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          onClick={() => setPreview(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Picha ya wasifu"
        >
          <div
            className="relative max-h-[80vh] max-w-[88vw] rounded-2xl bg-surface p-3 shadow-neu cursor-zoom-out"
            onClick={e => e.stopPropagation()}
          >
            <img src={src} alt="Picha ya wasifu" className="rounded-xl object-contain bg-surface max-h-[70vh] w-auto" />
            <button
              type="button"
              onClick={() => setPreview(false)}
              aria-label="Funga"
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-surface shadow-neu-sm text-text-secondary flex items-center justify-center hover:text-text"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  )
}
