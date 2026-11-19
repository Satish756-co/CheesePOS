import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, TrendingDown, Users, Settings, LogOut,
  Menu, X, Store, Shield, Headphones, ChevronDown, Building2,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authAPI, supportAPI, salonAPI } from '@/api'
import BrandLogo from '@/components/BrandLogo'
import { BUSINESS_CONFIG } from '@/config/businessConfig'

// Universal nav items shown for all business types
const UNIVERSAL_NAV = [
  { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard',        permission: 'dashboard' },
  { to: '/app/expenses',  icon: TrendingDown,    label: 'Expenses',         permission: 'expenses' },
  { to: '/app/users',     icon: Users,           label: 'Users & Roles',    permission: 'users' },
  { to: '/app/roles',     icon: Shield,          label: 'Role Permissions', permission: 'roles' },
  { to: '/app/outlets',   icon: Store,           label: 'Outlets',          permission: 'outlets' },
  { to: '/app/settings',  icon: Settings,        label: 'Settings',         permission: null },
  { to: '/app/support',   icon: Headphones,      label: 'Support',          permission: 'support' },
]

function SidebarNav({ items, badges = {}, sidebarOpen, onNavigate }) {
  return (
    <nav className="flex-1 py-4 overflow-y-auto sidebar-scroll">
      {items.map(({ to, icon: Icon, label }) => {
        const badgeCount = badges[to] || 0
        return (
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
              {badgeCount > 0 && !sidebarOpen && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </div>
            {sidebarOpen && <span className="text-sm font-medium truncate flex-1">{label}</span>}
            {sidebarOpen && badgeCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

export default function CustomerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const { user, tenant, token, logout, hasPermission, refreshPermissions, businesses, switchBusiness } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: unreadData } = useQuery({
    queryKey: ['support-unread-count'],
    queryFn: () => supportAPI.getUnreadCount().then(r => r.data),
    refetchInterval: 30000,
    enabled: !!token,
  })
  const supportBadge = unreadData?.count || 0

  const isSalon = tenant?.business_type === 'saloon'
  const isManager = ['owner', 'admin', 'manager'].includes(user?.role)
  const { data: cancelReqData = [] } = useQuery({
    queryKey: ['salon-cancel-requests', tenant?.id, 'pending'],
    queryFn: () => salonAPI.listCancelRequests({ status: 'pending' }).then(r => r.data),
    refetchInterval: 12000,
    enabled: !!token && isSalon && isManager,
  })
  const cancelBadge = cancelReqData.length

  const badges = {
    '/app/support': supportBadge,
    ...(cancelBadge > 0 ? { '/app/salon/bills': cancelBadge } : {}),
  }

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

  const handleSwitchBusiness = async (tenantId) => {
    if (tenantId === tenant?.id) { setSwitcherOpen(false); return }
    setSwitching(true)
    try {
      await switchBusiness(tenantId)
      qc.clear()
      setSwitcherOpen(false)
      navigate(useAuthStore.getState().getHomeRoute(), { replace: true })
    } catch {
      // error handled by switchBusiness via toast
    } finally {
      setSwitching(false)
    }
  }

  const otherBusinesses = (businesses || []).filter(b => b.id !== tenant?.id)

  const BusinessHeader = ({ expanded }) => {
    if (!expanded) {
      return (
        <div className="flex items-center justify-center h-16">
          <img src="/logo-icon.png" alt="CheesePOS" className="h-8 w-auto" />
        </div>
      )
    }
    return (
      <div className="px-4 py-3 relative">
        <BrandLogo theme="dark" size="sm" showSubtitle={false} businessName={tenant?.business_name} />
        {otherBusinesses.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setSwitcherOpen(o => !o)}
              disabled={switching}
              className="flex items-center gap-1.5 text-xs text-sidebar-text hover:text-white transition-colors w-full"
            >
              <Building2 size={12} />
              <span className="truncate flex-1 text-left">Switch business</span>
              <ChevronDown size={12} className={`transition-transform ${switcherOpen ? 'rotate-180' : ''}`} />
            </button>
            {switcherOpen && (
              <div className="mt-1 bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                {businesses.map(biz => (
                  <button
                    key={biz.id}
                    onClick={() => handleSwitchBusiness(biz.id)}
                    disabled={switching}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition-colors flex items-center gap-2
                      ${biz.id === tenant?.id ? 'text-white font-medium bg-slate-700/50' : 'text-slate-300'}`}
                  >
                    <Building2 size={11} className="flex-shrink-0" />
                    <span className="truncate">{biz.business_name}</span>
                    {biz.id === tenant?.id && <span className="ml-auto text-brand-400 text-[10px]">Active</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const bizNavItems = BUSINESS_CONFIG[tenant?.business_type]?.navItems || []
  const allNavItems = [...UNIVERSAL_NAV, ...bizNavItems]
  const visibleItems = allNavItems.filter(item =>
    item.permission === null || hasPermission(item.permission)
  )

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
      {expanded && (
        <Link to="/app/terms" className="block mt-2 text-center text-[10px] text-sidebar-text hover:text-white transition-colors opacity-50 hover:opacity-100">
          Terms of Service
        </Link>
      )}
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <aside className={`hidden md:flex flex-col bg-sidebar-bg transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} flex-shrink-0`}>
        <div className="border-b border-sidebar-border flex-shrink-0">
          <BusinessHeader expanded={sidebarOpen} />
        </div>
        <SidebarNav items={visibleItems} badges={badges} sidebarOpen={sidebarOpen} onNavigate={() => {}} />
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
        {otherBusinesses.length > 0 && (
          <div className="px-4 py-2 border-b border-sidebar-border">
            <p className="text-xs text-sidebar-text mb-1">Switch business</p>
            <div className="space-y-1">
              {businesses.map(biz => (
                <button
                  key={biz.id}
                  onClick={() => { handleSwitchBusiness(biz.id); setMobileOpen(false) }}
                  disabled={switching}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2
                    ${biz.id === tenant?.id ? 'text-white bg-slate-700' : 'text-slate-300 hover:bg-slate-700'}`}
                >
                  <Building2 size={11} />
                  <span className="truncate">{biz.business_name}</span>
                  {biz.id === tenant?.id && <span className="ml-auto text-brand-400 text-[10px]">Active</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <SidebarNav items={visibleItems} badges={badges} sidebarOpen={true} onNavigate={() => setMobileOpen(false)} />
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
