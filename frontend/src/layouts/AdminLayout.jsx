import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Users, CreditCard, BarChart2,
  Headphones, Activity, Package, LogOut, Menu, X
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authAPI, supportAPI } from '@/api'
import BrandLogo from '@/components/BrandLogo'

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/tenants', icon: Users, label: 'Customers' },
  { to: '/admin/subscriptions', icon: CreditCard, label: 'Subscriptions' },
  { to: '/admin/plans', icon: Package, label: 'Plans' },
  { to: '/admin/revenue', icon: BarChart2, label: 'Revenue' },
  { to: '/admin/support', icon: Headphones, label: 'Support' },
  { to: '/admin/system', icon: Activity, label: 'System' },
]

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { user, token, logout } = useAuthStore()
  const navigate = useNavigate()

  const { data: unreadData } = useQuery({
    queryKey: ['support-unread-count'],
    queryFn: () => supportAPI.getUnreadCount().then(r => r.data),
    refetchInterval: 30000,
    enabled: !!token,
  })
  const supportBadge = unreadData?.count || 0

  const handleLogout = async () => {
    try { await authAPI.logout() } catch {}
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className={`flex flex-col bg-slate-900 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} flex-shrink-0`}>
        <div className={`flex items-center border-b border-slate-800 flex-shrink-0 ${sidebarOpen ? 'px-4 py-3' : 'justify-center h-16'}`}>
          {sidebarOpen ? (
            <BrandLogo theme="dark" size="sm" showSubtitle={false} />
          ) : (
            <img src="/logo-icon.png" alt="CheesePOS" className="h-8 w-auto" />
          )}
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors mb-0.5
                ${isActive
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <div className="relative flex-shrink-0">
                <Icon size={18} />
                {to === '/admin/support' && supportBadge > 0 && !sidebarOpen && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </div>
              {sidebarOpen && <span className="text-sm font-medium flex-1">{label}</span>}
              {sidebarOpen && to === '/admin/support' && supportBadge > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                  {supportBadge > 9 ? '9+' : supportBadge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">SA</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.full_name}</p>
                <p className="text-slate-400 text-xs">Super Admin</p>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-400">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full flex justify-center text-slate-400 hover:text-red-400">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 hover:text-gray-700">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1" />
          <span className="text-sm text-gray-500">CheesePOS SaaS Platform</span>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
