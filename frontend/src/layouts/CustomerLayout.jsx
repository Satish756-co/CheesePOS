import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Receipt, Table2, ShoppingCart, ChefHat,
  Package, Warehouse, Truck, TrendingDown, BarChart2, Users,
  Settings, LogOut, Menu, X, Store, ClipboardList, Shield, CalendarDays, Headphones
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authAPI, supportAPI } from '@/api'
import BrandLogo from '@/components/BrandLogo'

const navItems = [
  { to: '/app/dashboard',    icon: LayoutDashboard, label: 'Dashboard',       permission: 'dashboard' },
  { to: '/app/daily',        icon: CalendarDays,    label: 'Daily Summary',   permission: 'dashboard' },
  { to: '/app/billing',      icon: Receipt,         label: 'Counter Billing', permission: 'billing' },
  { to: '/app/table-billing',icon: Table2,          label: 'Table Billing',   permission: 'table_billing' },
  { to: '/app/tables',       icon: Table2,          label: 'Tables',          permission: 'tables' },
  { to: '/app/orders',       icon: ShoppingCart,    label: 'Orders',          permission: 'orders' },
  { to: '/app/sales-log',    icon: ClipboardList,   label: 'Sales Log',       permission: 'sales_log' },
  { to: '/app/kot',          icon: ChefHat,         label: 'Kitchen / KOT',   permission: 'kot' },
  { to: '/app/products',     icon: Package,         label: 'Products',        permission: 'products' },
  { to: '/app/inventory',    icon: Warehouse,       label: 'Inventory',       permission: 'inventory' },
  { to: '/app/purchases',    icon: Truck,           label: 'Purchases',       permission: 'purchases' },
  { to: '/app/expenses',     icon: TrendingDown,    label: 'Expenses',        permission: 'expenses' },
  { to: '/app/reports',      icon: BarChart2,       label: 'Reports',         permission: 'reports' },
  { to: '/app/users',        icon: Users,           label: 'Users & Roles',   permission: 'users' },
  { to: '/app/roles',        icon: Shield,          label: 'Role Permissions',permission: 'roles' },
  { to: '/app/outlets',      icon: Store,           label: 'Outlets',         permission: 'outlets' },
  { to: '/app/settings',     icon: Settings,        label: 'Settings',        permission: null },
  { to: '/app/support',      icon: Headphones,      label: 'Support',         permission: null },
]

function SidebarNav({ items, supportBadge, sidebarOpen, onNavigate }) {
  return (
    <nav className="flex-1 py-4 overflow-y-auto sidebar-scroll">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors mb-0.5
            ${isActive
              ? 'bg-sidebar-active text-white'
              : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
            }`
          }
        >
          <div className="relative flex-shrink-0">
            <Icon size={18} />
            {to === '/app/support' && supportBadge > 0 && !sidebarOpen && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </div>
          {sidebarOpen && <span className="text-sm font-medium truncate flex-1">{label}</span>}
          {sidebarOpen && to === '/app/support' && supportBadge > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
              {supportBadge > 9 ? '9+' : supportBadge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default function CustomerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, tenant, token, logout, hasPermission, refreshPermissions } = useAuthStore()
  const navigate = useNavigate()

  const { data: unreadData } = useQuery({
    queryKey: ['support-unread-count'],
    queryFn: () => supportAPI.getUnreadCount().then(r => r.data),
    refetchInterval: 30000,
    enabled: !!token,
  })
  const supportBadge = unreadData?.count || 0

  useEffect(() => {
    refreshPermissions()
    const onFocus = () => refreshPermissions()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Close mobile menu on resize to desktop
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

  const visibleItems = navItems.filter(item => item.permission === null || hasPermission(item.permission))

  const UserFooter = ({ expanded }) => (
    <div className="border-t border-sidebar-border p-4 flex-shrink-0">
      {expanded ? (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-sidebar-text text-xs truncate capitalize">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="text-sidebar-text hover:text-red-400 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      ) : (
        <button onClick={handleLogout} className="w-full flex justify-center text-sidebar-text hover:text-red-400">
          <LogOut size={18} />
        </button>
      )}
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <aside className={`hidden md:flex flex-col bg-sidebar-bg transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} flex-shrink-0`}>
        <div className={`flex items-center border-b border-sidebar-border flex-shrink-0 ${sidebarOpen ? 'px-4 py-3' : 'justify-center h-16'}`}>
          {sidebarOpen ? (
            <BrandLogo theme="dark" size="sm" showSubtitle={false} businessName={tenant?.business_name} />
          ) : (
            <img src="/logo-icon.png" alt="CheesePOS" className="h-8 w-auto" />
          )}
        </div>
        <SidebarNav items={visibleItems} supportBadge={supportBadge} sidebarOpen={sidebarOpen} onNavigate={() => {}} />
        <UserFooter expanded={sidebarOpen} />
      </aside>

      {/* ── Mobile overlay backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-sidebar-bg z-50 flex flex-col transform transition-transform duration-300 md:hidden
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border flex-shrink-0">
          <BrandLogo theme="dark" size="sm" showSubtitle={false} businessName={tenant?.business_name} />
          <button onClick={() => setMobileOpen(false)} className="text-sidebar-text hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        <SidebarNav items={visibleItems} supportBadge={supportBadge} sidebarOpen={true} onNavigate={() => setMobileOpen(false)} />
        <UserFooter expanded={true} />
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-14 md:h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-gray-500 hover:text-gray-700 p-1"
          >
            <Menu size={22} />
          </button>

          {/* Desktop sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:block text-gray-500 hover:text-gray-700"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Business name on mobile */}
          <span className="md:hidden text-sm font-semibold text-gray-700 truncate flex-1">
            {tenant?.business_name || 'CheesePOS'}
          </span>

          <div className="hidden md:block flex-1" />

          {tenant?.status === 'trial' && (
            <div className="bg-brand-50 border border-brand-200 text-brand-700 text-xs px-2 py-1 rounded-full whitespace-nowrap">
              Trial: {tenant?.trial_ends_at
                ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
                : 0}d left
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
