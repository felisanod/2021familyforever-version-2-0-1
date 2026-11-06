import { useEffect, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../hooks/useNotifications'
import { markUnreadAnnouncementsRead } from '../../services/notifications'
import ProfileMenu from './ProfileMenu'

const navItems = [
  { to: '/', label: 'Dashibodi', icon: DashboardIcon },
  { to: '/updates', label: 'Taarifa', icon: UpdatesIcon },
  { to: '/contributions', label: 'Michango', icon: ContributionsIcon },
  { to: '/reports', label: 'Ripoti', icon: ReportsIcon },
  { to: '/profile', label: 'Wasifu', icon: ProfileIcon },
]

const titleMap: Record<string, string> = {
  '/': 'Dashibodi',
  '/updates': 'Taarifa',
  '/contributions': 'Michango',
  '/members': 'Wanachama',
  '/reports': 'Ripoti',
  '/notifications': 'Arifa',
  '/profile': 'Wasifu',
}

export default function MemberLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const { unreadAnnouncementCount, refresh } = useNotifications(user?.user_id)

  // Viewing Taarifa acknowledges its update badge, without affecting other
  // notification types such as payments or contributions.
  useEffect(() => {
    if (location.pathname !== '/updates') return
    void markUnreadAnnouncementsRead().then(() => refresh())
  }, [location.pathname, refresh])

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      mainRef.current?.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }
  }, [location.pathname])

  return (
    <div className="app-shell flex flex-col bg-background">
      <header className="mobile-app-bar neu-surface sticky top-0 z-50 flex items-center justify-between border-b border-border-light px-4">
        <button className="flex min-h-11 min-w-0 items-center gap-3 text-left" onClick={() => navigate('/')} aria-label="2021familyforever home">
          <img className="h-9 w-9 rounded-lg object-cover" src="/icons/icon-192x192.png" alt="" />
          <span className="hidden truncate font-semibold text-text sm:block">2021familyforever</span>
          <span className="truncate text-base font-semibold text-text sm:hidden">{titleMap[location.pathname] ?? '2021familyforever'}</span>
        </button>
        <div className="flex items-center gap-2">
          <ProfileMenu onSwitchInterface={() => navigate('/admin')} />
        </div>
      </header>

      <main ref={mainRef} className="app-main flex-1 overflow-y-auto pb-24 md:pb-6">
        <div key={location.pathname} className="screen-enter min-h-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="mobile-bottom-nav neu-surface fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border-light bg-surface/95 backdrop-blur md:hidden" aria-label="Urambazaji mkuu">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `relative flex min-h-11 min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1 text-[10px] font-semibold transition-all duration-150 hover:bg-primary-50 hover:text-primary hover:shadow-neu-inset-sm sm:min-w-[64px] sm:text-[11px] ${isActive ? 'bg-primary-50 text-primary shadow-neu-inset-sm' : 'text-text-secondary'}`
            }
          >
            <item.icon />
            {item.label}
            {item.to === '/updates' && unreadAnnouncementCount > 0 && (
              <span className="absolute top-1 right-3 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-surface" aria-label="Kuna taarifa mpya" />
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function DashboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}
function UpdatesIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}
function ContributionsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}
function ProfileIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}
function ReportsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19V5m0 14h16M8 15l3-4 3 2 5-7" />
    </svg>
  )
}
