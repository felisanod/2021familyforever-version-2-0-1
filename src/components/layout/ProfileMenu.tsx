import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { initialsOf } from '../../utils/format'

type Props = { onSwitchInterface?: () => void }

/** Avatar dropdown: Profile, Settings, Switch Interface (admins), Logout. */
export default function ProfileMenu({ onSwitchInterface }: Props) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menyu ya akaunti"
        className="w-9 h-9 rounded-full bg-primary-50 text-primary font-semibold text-xs flex items-center justify-center hover:bg-primary/10 transition-colors"
      >
        {user?.profile_picture ? (
          <img src={user.profile_picture} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          initialsOf(user?.full_name)
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-52 card shadow-lg py-1.5 z-50" role="menu">
          <div className="px-3.5 py-2 border-b border-border-light">
            <p className="text-sm font-semibold text-text truncate">{user?.full_name}</p>
            <p className="text-xs text-text-secondary">{user?.phone_number}</p>
          </div>
          <button
            className="w-full text-left px-3.5 py-2 text-sm text-text hover:bg-border-light"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate('/profile')
            }}
          >
            Wasifu
          </button>
          <button
            className="w-full text-left px-3.5 py-2 text-sm text-text hover:bg-border-light"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate('/profile?tab=settings')
            }}
          >
            Mpangilio
          </button>
          {onSwitchInterface && user?.role === 'ADMIN' && (
            <button
              className="w-full text-left px-3.5 py-2 text-sm text-primary hover:bg-primary-50"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onSwitchInterface()
              }}
            >
              Badili Kiolesura
            </button>
          )}
          <button
            className="w-full text-left px-3.5 py-2 text-sm text-error hover:bg-error-50"
            role="menuitem"
            onClick={handleLogout}
          >
            Toka
          </button>
        </div>
      )}
    </div>
  )
}