import { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import ProfileMenu from './ProfileMenu'
import Modal from '../ui/Modal'

const adminNav = [
  { to: '/admin', label: 'Dashibodi', icon: DashboardIcon, end: true },
  { to: '/admin/members', label: 'Wanachama', icon: MembersIcon },
  { to: '/admin/contributions', label: 'Michango', icon: ContributionsIcon },
  { to: '/admin/payments', label: 'Malipo', icon: PaymentsIcon },
]

// Sidebar-only items (reachable on mobile via "More")
const moreNav = [
  { to: '/admin/reports', label: 'Ripoti', icon: ReportsIcon, end: false },
  { to: '/admin/activity', label: 'Kumbukumbu', icon: ActivityIcon, end: false },
  { to: '/admin/announcements', label: 'Taarifa', icon: AnnouncementsIcon, end: false },
  { to: '/admin/profile', label: 'Wasifu', icon: ProfileIcon, end: false },
]

const titleMap: Record<string, string> = {
  '/admin': 'Dashibodi',
  '/admin/members': 'Wanachama',
  '/admin/contributions': 'Michango',
  '/admin/payments': 'Malipo',
  '/admin/reports': 'Ripoti',
  '/admin/activity': 'Kumbukumbu za shughuli',
  '/admin/announcements': 'Taarifa',
  '/admin/profile': 'Wasifu',
}

export default function AdminLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      mainRef.current?.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }
  }, [location.pathname])

  return (
    <div className="app-shell flex bg-background">
      {/* Desktop sidebar */}
      <aside className="neu-surface hidden w-56 flex-col shrink-0 md:flex">
        <div className="h-14 flex items-center gap-3 px-4 border-b border-border-light">
          <img className="h-9 w-9 rounded-lg object-cover" src="/icons/icon-192x192.png" alt="" />
          <span className="font-semibold text-sm text-text">2021familyforever</span>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto" aria-label="Urambazaji wa ">
          {[...adminNav, ...moreNav].map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 space-y-1 pt-4">
          <button onClick={() => navigate('/')} className="sidebar-link w-full"><MembersIcon /> Kiolesura cha Mwanachama</button>
        </div>
      </aside>

      <div className="app-shell flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="mobile-app-bar neu-surface relative z-10 flex items-center justify-between gap-3 border-b border-border-light px-4">
          <h2 className="font-semibold text-text truncate">{titleMap[location.pathname] ?? 'Dashibodi'}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary hidden lg:block">{user?.full_name}</span>
            <ProfileMenu onSwitchInterface={() => navigate('/')} />
          </div>
        </header>
        <main ref={mainRef} className="app-main flex-1 overflow-y-auto p-4 pb-24 sm:p-6 md:pb-6">
          <div key={location.pathname} className="screen-enter min-h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation with compact More menu */}
      <nav className="mobile-bottom-nav neu-surface fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border-light bg-surface/95 backdrop-blur md:hidden" aria-label="Urambazaji wa ">
        {adminNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex min-h-11 min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1 text-[10px] font-semibold transition-all duration-150 hover:bg-primary-50 hover:text-primary hover:shadow-neu-inset-sm sm:min-w-[64px] sm:text-[11px] ${isActive ? 'bg-primary-50 text-primary shadow-neu-inset-sm' : 'text-text-secondary'}`
            }
          >
            <item.icon />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex min-h-11 min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1 text-[10px] font-semibold transition-all duration-150 hover:bg-primary-50 hover:text-primary hover:shadow-neu-inset-sm sm:min-w-[64px] sm:text-[11px] ${moreNav.some(i => i.to === location.pathname) ? 'bg-primary-50 text-primary shadow-neu-inset-sm' : 'text-text-secondary'}`}
        >
          <MoreIcon />
          Zaidi
        </button>
      </nav>

      <Modal open={moreOpen} title="Zaidi" onClose={() => setMoreOpen(false)}>
        <div className="space-y-1">
          {moreNav.map(item => (
            <button
              key={item.to}
              onClick={() => {
                setMoreOpen(false)
                navigate(item.to)
              }}
              className={`sidebar-link w-full ${location.pathname === item.to ? 'active' : ''}`}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
          <button
            onClick={() => {
              setMoreOpen(false)
              navigate('/')
            }}
            className="sidebar-link w-full"
          >
            <MembersIcon /> Kiolesura cha Mwanachama
          </button>
        </div>
      </Modal>
    </div>
  )
}

function DashboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}
function MembersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-6.93M15 10a4 4 0 11-8 0 4 4 0 018 0zm6 10v-1.5a4 4 0 00-2.5-3.7" />
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
function PaymentsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}
function AnnouncementsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
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
function MoreIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
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
function ActivityIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  )
}
