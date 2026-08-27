import { useState } from 'react'
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
  { to: '/admin/announcements', label: 'Taarifa', icon: AnnouncementsIcon, end: false },
  { to: '/admin/profile', label: 'Wasifu', icon: ProfileIcon, end: false },
]

const titleMap: Record<string, string> = {
  '/admin': 'Dashibodi',
  '/admin/members': 'Wanachama',
  '/admin/contributions': 'Michango',
  '/admin/payments': 'Malipo',
  '/admin/announcements': 'Taarifa',
  '/admin/profile': 'Wasifu',
}

export default function AdminLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div className="h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-surface border-r border-border flex-col shrink-0">
        <div className="h-14 flex items-center gap-3 px-4 border-b border-border">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">21</span>
          </div>
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
        <div className="p-3 border-t border-border space-y-1">
          <button onClick={() => navigate('/')} className="sidebar-link w-full"><MembersIcon /> Kiolesura cha Mwanachama</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <header className="bg-surface border-b border-border px-4 h-14 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-text truncate">{titleMap[location.pathname] ?? 'Dashibodi'}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary hidden lg:block">{user?.full_name}</span>
            <ProfileMenu onSwitchInterface={() => navigate('/')} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation with compact More menu */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border h-16 flex items-center justify-around z-50" aria-label="Urambazaji wa ">
        {adminNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-xl p-2 text-[11px] font-medium min-w-[64px] transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-50 hover:text-primary ${isActive ? 'bg-primary-50 text-primary shadow-sm' : 'text-text-secondary'}`
            }
          >
            <item.icon />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center gap-1 rounded-xl p-2 text-[11px] font-medium min-w-[64px] transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-50 hover:text-primary ${moreNav.some(i => i.to === location.pathname) ? 'bg-primary-50 text-primary shadow-sm' : 'text-text-secondary'}`}
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
