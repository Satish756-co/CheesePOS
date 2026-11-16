import { useState, useEffect } from 'react'
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

function AdminNav({ items, supportBadge, expanded, onNavigate }) {
  return (
    <nav className="flex-1 py-4 overflow-y-auto">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
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
            {to === '/admin/support' && supportBadge > 0 && !expanded && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </div>
          {expanded && <span className="text-sm font-medium flex-1">{label}</span>}
          {expanded && to === '/admin/support' && supportBadge > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
              {supportBadge > 9 ? '9+' : supportBadge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, token, logout } = useAuthStore()
  const navigate = useNavigate()

  const { data: unreadData } = useQuery({
    queryKey: ['support-unread-count'],
    queryFn: () => supportAPI.getUnreadCount().then(r => r.data),
    refetchInterval: 30000,
    enabled: !!token,
  })
  const supportBadge = unreadData?.count || 0

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleLogout = async () => {
    try { await authAPI.logout() } catch {}
    logout()
    navigate('/login')
  }

  const UserFooter = ({ expanded }) => (
    <div className="border-t border-slate-800 p-4">
      {expanded ? (
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
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <aside className={`hidden md:flex flex-col bg-slate-900 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} flex-shrink-0`}>
        <div className={`flex items-center border-b border-slate-800 flex-shrink-0 ${sidebarOpen ? 'px-4 py-3' : 'justify-center h-16'}`}>
          {sidebarOpen ? (
            <BrandLogo theme="dark" size="sm" showSubtitle={false} />
          ) : (
            <img src="/logo-icon.png" alt="CheesePOS" className="h-8 w-auto" />
          )}
        </div>
        <AdminNav items={navItems} supportBadge={supportBadge} expanded={sidebarOpen} onNavigate={() => {}} />
        <UserFooter expanded={sidebarOpen} />
      </aside>

      {/* ── Mobile overlay backdrop ── */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Mobile drawer ── */}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-slate-900 z-50 flex flex-col transform transition-transform duration-300 md:hidden
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <BrandLogo theme="dark" size="sm" showSubtitle={false} />
          <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        <AdminNav items={navItems} supportBadge={supportBadge} expanded={true} onNavigate={() => setMobileOpen(false)} />
        <UserFooter expanded={true} />
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 md:h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-gray-500 hover:text-gray-700 p-1">
            <Menu size={22} />
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden md:block text-gray-500 hover:text-gray-700">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="md:hidden text-sm font-semibold text-gray-700 flex-1">CheesePOS Admin</span>
          <div className="hidden md:block flex-1" />
          <span className="hidden md:block text-sm text-gray-500">CheesePOS SaaS Platform</span>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
