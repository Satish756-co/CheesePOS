import { useState, useEffect, useRef } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { authAPI } from '@/api'

// Layouts
import AuthLayout from '@/layouts/AuthLayout'
import CustomerLayout from '@/layouts/CustomerLayout'
import AdminLayout from '@/layouts/AdminLayout'

// Auth pages
import Login from '@/pages/auth/Login'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import SelectBusiness from '@/pages/auth/SelectBusiness'

// Landing
import Landing from '@/pages/Landing'

// Customer pages
import CustomerDashboard from '@/pages/customer/Dashboard'
import DailySummary from '@/pages/customer/DailySummary'
import Billing from '@/pages/customer/Billing'
import TableBilling from '@/pages/customer/TableBilling'
import Tables from '@/pages/customer/Tables'
import Orders from '@/pages/customer/Orders'
import SalesLog from '@/pages/customer/SalesLog'
import KOT from '@/pages/customer/KOT'
import Products from '@/pages/customer/Products'
import Inventory from '@/pages/customer/Inventory'
import Purchases from '@/pages/customer/Purchases'
import Expenses from '@/pages/customer/Expenses'
import Reports from '@/pages/customer/Reports'
import Users from '@/pages/customer/Users'
import RolePermissions from '@/pages/customer/RolePermissions'
import Settings from '@/pages/customer/Settings'
import Outlets from '@/pages/customer/Outlets'
import CustomerSupport from '@/pages/customer/Support'
import WhatsAppSettings from '@/pages/customer/WhatsAppSettings'
import Terms, { TermsContent } from '@/pages/Terms'

// Salon pages
import SalonBilling from '@/pages/salon/Billing'
import SalonBillsLog from '@/pages/salon/BillsLog'
import SalonServices from '@/pages/salon/Services'
import SalonCoupons from '@/pages/salon/Coupons'
import SalonSummary from '@/pages/salon/Summary'
import SalonReports from '@/pages/salon/Reports'

// Admin pages
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminTenants from '@/pages/admin/Tenants'
import AdminTenantDetail from '@/pages/admin/TenantDetail'
import AdminSubscriptions from '@/pages/admin/Subscriptions'
import AdminPlans from '@/pages/admin/Plans'
import AdminRevenue from '@/pages/admin/Revenue'
import AdminSupport from '@/pages/admin/Support'
import AdminSystem from '@/pages/admin/System'
import AdminOnboarding from '@/pages/admin/OnboardingRequests'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (adminOnly && !user?.is_super_admin) return <Navigate to="/app/dashboard" replace />
  if (!adminOnly && user?.is_super_admin) return <Navigate to="/admin/dashboard" replace />
  return children
}

function PublicRoute({ children }) {
  const { token } = useAuthStore()
  if (token) {
    return <Navigate to={useAuthStore.getState().getHomeRoute()} replace />
  }
  return children
}

// Redirects to the first page the user can actually access
function HomeRedirect() {
  const { getHomeRoute } = useAuthStore()
  return <Navigate to={getHomeRoute()} replace />
}

// Guards a page — redirects away if the user lacks permission
function PermissionRoute({ permission, children }) {
  const { hasPermission, getHomeRoute } = useAuthStore()
  if (permission !== null && !hasPermission(permission)) {
    return <Navigate to={getHomeRoute()} replace />
  }
  return children
}

function ForcePasswordChangeModal() {
  const { user } = useAuthStore()
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')

  const mutation = useMutation({
    mutationFn: (pwd) => authAPI.setInitialPassword(pwd),
    onSuccess: (res) => {
      useAuthStore.setState({
        user: res.data.user,
        token: res.data.access_token,
        refreshToken: res.data.refresh_token,
      })
    },
    onError: (e) => {
      setErr(e?.response?.data?.error || 'Something went wrong')
    },
  })

  if (!user?.must_change_password) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    setErr('')
    if (newPassword.length < 8) return setErr('Password must be at least 8 characters')
    if (newPassword !== confirm) return setErr('Passwords do not match')
    mutation.mutate(newPassword)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Set Your Password</h2>
          <p className="mt-1 text-sm text-gray-500">Your account was created with a temporary password. Please set a new password to continue.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Minimum 8 characters"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Re-enter your new password"
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

function TermsAcceptModal() {
  const { user } = useAuthStore()
  const [checked, setChecked] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const scrollRef = useRef(null)

  const mutation = useMutation({
    mutationFn: () => authAPI.acceptTerms(),
    onSuccess: (res) => {
      useAuthStore.setState({ user: res.data.user })
    },
  })

  // Don't show if already accepted or password change is pending
  if (!user || user.terms_accepted_at || user.must_change_password) return null

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 32) {
      setScrolledToBottom(true)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Terms of Service</h2>
            <p className="text-sm text-gray-500">Please read and accept before continuing</p>
          </div>
        </div>

        {/* Scrollable terms */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4 min-h-0"
        >
          <TermsContent />
          {!scrolledToBottom && (
            <p className="text-center text-xs text-gray-400 mt-4 pb-2">↓ Scroll to the bottom to continue</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex-shrink-0 space-y-3">
          <label className={`flex items-start gap-3 cursor-pointer ${!scrolledToBottom ? 'opacity-40 pointer-events-none' : ''}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
            />
            <span className="text-sm text-gray-700">
              I have read and agree to the <strong>CheesePOS Terms of Service</strong> and confirm that I am authorised to accept on behalf of my business.
            </span>
          </label>
          <button
            onClick={() => mutation.mutate()}
            disabled={!checked || mutation.isPending}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {mutation.isPending ? 'Saving…' : 'Accept & Continue →'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default function App() {
  const { isSessionExpired, logout, token } = useAuthStore()

  useEffect(() => {
    if (!token) return
    const interval = setInterval(() => {
      if (isSessionExpired()) {
        logout()
        window.location.href = '/login'
      }
    }, 60 * 1000)
    return () => clearInterval(interval)
  }, [token])

  return (
    <>
      <ForcePasswordChangeModal />
      <TermsAcceptModal />
      <Routes>
      {/* Public landing */}
      <Route path="/" element={<Landing />} />

      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      </Route>

      {/* Business selector — outside AuthLayout so it has its own full-screen style */}
      <Route path="/select-business" element={<SelectBusiness />} />

      {/* Customer portal */}
      <Route path="/app" element={
        <ProtectedRoute><CustomerLayout /></ProtectedRoute>
      }>
        <Route index element={<HomeRedirect />} />
        <Route path="dashboard" element={<PermissionRoute permission="dashboard"><CustomerDashboard /></PermissionRoute>} />
        <Route path="daily" element={<PermissionRoute permission="dashboard"><DailySummary /></PermissionRoute>} />
        <Route path="billing" element={<PermissionRoute permission="billing"><Billing /></PermissionRoute>} />
        <Route path="table-billing" element={<PermissionRoute permission="table_billing"><TableBilling /></PermissionRoute>} />
        <Route path="tables" element={<PermissionRoute permission="tables"><Tables /></PermissionRoute>} />
        <Route path="orders" element={<PermissionRoute permission="orders"><Orders /></PermissionRoute>} />
        <Route path="sales-log" element={<PermissionRoute permission="sales_log"><SalesLog /></PermissionRoute>} />
        <Route path="kot" element={<PermissionRoute permission="kot"><KOT /></PermissionRoute>} />
        <Route path="products" element={<PermissionRoute permission="products"><Products /></PermissionRoute>} />
        <Route path="inventory" element={<PermissionRoute permission="inventory"><Inventory /></PermissionRoute>} />
        <Route path="purchases" element={<PermissionRoute permission="purchases"><Purchases /></PermissionRoute>} />
        <Route path="expenses" element={<PermissionRoute permission="expenses"><Expenses /></PermissionRoute>} />
        <Route path="reports" element={<PermissionRoute permission="reports"><Reports /></PermissionRoute>} />
        <Route path="users" element={<PermissionRoute permission="users"><Users /></PermissionRoute>} />
        <Route path="roles" element={<PermissionRoute permission="roles"><RolePermissions /></PermissionRoute>} />
        <Route path="outlets" element={<PermissionRoute permission="outlets"><Outlets /></PermissionRoute>} />
        <Route path="settings"  element={<PermissionRoute permission={null}><Settings /></PermissionRoute>} />
        <Route path="support"   element={<PermissionRoute permission={null}><CustomerSupport /></PermissionRoute>} />
        <Route path="whatsapp"  element={<WhatsAppSettings />} />
        <Route path="terms"     element={<Terms />} />

        {/* Salon / Spa routes */}
        <Route path="salon">
          <Route path="billing"  element={<PermissionRoute permission="salon_billing"><SalonBilling /></PermissionRoute>} />
          <Route path="bills"    element={<PermissionRoute permission="salon_billing"><SalonBillsLog /></PermissionRoute>} />
          <Route path="services" element={<PermissionRoute permission="salon_services"><SalonServices /></PermissionRoute>} />
          <Route path="coupons"  element={<PermissionRoute permission="salon_coupons"><SalonCoupons /></PermissionRoute>} />
          <Route path="summary"  element={<PermissionRoute permission="salon_summary"><SalonSummary /></PermissionRoute>} />
          <Route path="reports"  element={<PermissionRoute permission="reports"><SalonReports /></PermissionRoute>} />
        </Route>
      </Route>

      {/* Super Admin portal */}
      <Route path="/admin" element={
        <ProtectedRoute adminOnly><AdminLayout /></ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="tenants" element={<AdminTenants />} />
        <Route path="tenants/:id" element={<AdminTenantDetail />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="plans" element={<AdminPlans />} />
        <Route path="revenue" element={<AdminRevenue />} />
        <Route path="support" element={<AdminSupport />} />
        <Route path="system" element={<AdminSystem />} />
        <Route path="onboarding" element={<AdminOnboarding />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
