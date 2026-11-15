import { useState, useEffect } from 'react'
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

// Admin pages
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminTenants from '@/pages/admin/Tenants'
import AdminTenantDetail from '@/pages/admin/TenantDetail'
import AdminSubscriptions from '@/pages/admin/Subscriptions'
import AdminPlans from '@/pages/admin/Plans'
import AdminRevenue from '@/pages/admin/Revenue'
import AdminSupport from '@/pages/admin/Support'
import AdminSystem from '@/pages/admin/System'

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
        <Route path="settings" element={<PermissionRoute permission={null}><Settings /></PermissionRoute>} />
        <Route path="support" element={<PermissionRoute permission={null}><CustomerSupport /></PermissionRoute>} />
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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
