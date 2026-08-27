import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import Loading from './components/ui/Loading'
import OfflineIndicator from './components/ui/OfflineIndicator'
import InstallPrompt from './components/ui/InstallPrompt'

// Lazy-loaded routes — smaller initial bundle, faster first paint.
const Login = lazy(() => import('./pages/auth/Login'))
const MemberLayout = lazy(() => import('./components/layout/MemberLayout'))
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'))
const MemberHome = lazy(() => import('./pages/member/Home'))
const MemberContributions = lazy(() => import('./pages/member/Contributions'))
const MemberMembers = lazy(() => import('./pages/member/Members'))
const MemberAnnouncements = lazy(() => import('./pages/member/Announcements'))
const MemberNotifications = lazy(() => import('./pages/member/Notifications'))
const MemberProfile = lazy(() => import('./pages/member/Profile'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminMembers = lazy(() => import('./pages/admin/Members'))
const AdminContributions = lazy(() => import('./pages/admin/Contributions'))
const AdminPayments = lazy(() => import('./pages/admin/Payments'))
const AdminAnnouncements = lazy(() => import('./pages/admin/Announcements'))
const AdminProfile = lazy(() => import('./pages/admin/Profile'))

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading full />
  if (!user) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading full />
  if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Suspense fallback={<Loading full />}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}><MemberLayout /></ProtectedRoute>}>
          <Route index element={<MemberHome />} />
          <Route path="contributions" element={<MemberContributions />} />
          <Route path="members" element={<MemberMembers />} />
          <Route path="updates" element={<MemberAnnouncements />} />
          {/* Backwards-compatible aliases */}
          <Route path="announcements" element={<Navigate to="/updates" replace />} />
          <Route path="notifications" element={<MemberNotifications />} />
          <Route path="profile" element={<MemberProfile />} />
        </Route>
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="members" element={<AdminMembers />} />
          <Route path="contributions" element={<AdminContributions />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <OfflineIndicator />
          <AppRoutes />
          <InstallPrompt />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}