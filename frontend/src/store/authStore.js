import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/api/client'

// Fallback hardcoded map used when effectivePermissions hasn't loaded yet
const FALLBACK_ROLE_PAGES = {
  owner: ['*'],
  admin: ['dashboard', 'billing', 'table_billing', 'orders', 'tables', 'sales_log',
          'kot', 'products', 'inventory', 'purchases', 'expenses', 'reports', 'users', 'roles', 'outlets'],
  manager: ['dashboard', 'billing', 'table_billing', 'orders', 'tables', 'sales_log',
             'kot', 'inventory', 'expenses', 'reports'],
  cashier: ['dashboard', 'billing', 'table_billing', 'sales_log'],
  waiter: ['dashboard', 'table_billing', 'orders', 'tables'],
  kitchen: ['dashboard', 'kot'],
  inventory_manager: ['dashboard', 'products', 'inventory', 'purchases'],
  accountant: ['dashboard', 'expenses', 'reports', 'sales_log'],
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      token: null,
      refreshToken: null,
      effectivePermissions: null,
      sessionExpiry: null,

      setAuth: (user, tenant, token, refreshToken, effectivePermissions = null) =>
        set({ user, tenant, token, refreshToken, effectivePermissions, sessionExpiry: Date.now() + 4 * 60 * 60 * 1000 }),

      setToken: (token) => set({ token }),

      setPermissions: (perms) => set({ effectivePermissions: perms }),

      // Fetch fresh permissions from /auth/me and update the store.
      // Call on app load and after role config changes.
      refreshPermissions: async () => {
        const token = get().token
        if (!token) return
        try {
          const res = await api.get('/auth/me')
          const data = res.data
          set({
            user: data.user ?? get().user,
            tenant: data.tenant ?? get().tenant,
            effectivePermissions: data.effective_permissions ?? get().effectivePermissions,
          })
        } catch {
          // silently ignore — stale permissions remain
        }
      },

      logout: () => set({ user: null, tenant: null, token: null, refreshToken: null, effectivePermissions: null, sessionExpiry: null }),

      isSessionExpired: () => {
        const expiry = get().sessionExpiry
        return expiry !== null && Date.now() > expiry
      },

      isAuthenticated: () => !!get().token,

      isSuperAdmin: () => get().user?.is_super_admin === true,

      hasRole: (role) => get().user?.role === role,

      hasPermission: (permission) => {
        const user = get().user
        if (!user) return false
        if (user.is_super_admin) return true
        if (user.role === 'owner') return true

        const perms = get().effectivePermissions
        const pages = perms?.pages ?? FALLBACK_ROLE_PAGES[user.role] ?? []
        if (pages.includes('*')) return true

        if (Array.isArray(permission)) {
          return permission.some(p => pages.includes(p))
        }
        return pages.includes(permission)
      },

      // Check if a fine-grained action is permitted (e.g. 'billing.cancel', 'reports.export')
      hasAction: (action) => {
        const user = get().user
        if (!user) return false
        if (user.is_super_admin) return true
        if (user.role === 'owner') return true

        const perms = get().effectivePermissions
        if (!perms) return false  // deny while permissions not yet loaded
        const actions = perms.actions || []
        if (actions.includes('*')) return true
        const [category] = action.split('.')
        if (actions.includes(`${category}.*`)) return true
        return actions.includes(action)
      },

      // Returns true if an action requires manager approval before completing
      requiresApproval: (action) => {
        const perms = get().effectivePermissions
        if (!perms) return false
        return (perms.approvals || []).includes(action)
      },

      // 'own' | 'outlet' | 'all'
      getDataScope: () => {
        const perms = get().effectivePermissions
        return perms?.data_scope ?? 'all'
      },

      // Returns outlet IDs the user can access (empty = all outlets)
      getAccessibleOutletIds: () => {
        const user = get().user
        if (!user) return []
        if (['owner', 'admin'].includes(user.role) || user.is_super_admin) return []
        return user.outlet_ids || []
      },

      getActiveOutlets: () => get().tenant?.outlets || [],

      // Returns the first accessible /app/* path for the current user.
      // Used for post-login redirect and bouncing users off forbidden pages.
      getHomeRoute: () => {
        const state = get()
        const user = state.user
        if (!user) return '/login'
        if (user.is_super_admin) return '/admin/dashboard'

        const ORDERED_PAGES = [
          { path: '/app/dashboard',    permission: 'dashboard' },
          { path: '/app/table-billing',permission: 'table_billing' },
          { path: '/app/billing',      permission: 'billing' },
          { path: '/app/orders',       permission: 'orders' },
          { path: '/app/tables',       permission: 'tables' },
          { path: '/app/kot',          permission: 'kot' },
          { path: '/app/sales-log',    permission: 'sales_log' },
          { path: '/app/inventory',    permission: 'inventory' },
          { path: '/app/products',     permission: 'products' },
          { path: '/app/purchases',    permission: 'purchases' },
          { path: '/app/expenses',     permission: 'expenses' },
          { path: '/app/reports',      permission: 'reports' },
          { path: '/app/users',        permission: 'users' },
          { path: '/app/roles',        permission: 'roles' },
          { path: '/app/outlets',      permission: 'outlets' },
        ]

        for (const { path, permission } of ORDERED_PAGES) {
          if (state.hasPermission(permission)) return path
        }
        return '/app/settings'
      },

      isSubscriptionActive: () => {
        const tenant = get().tenant
        if (!tenant) return false
        if (tenant.status === 'trial') {
          if (!tenant.trial_ends_at) return true
          return new Date(tenant.trial_ends_at) > new Date()
        }
        return tenant.status === 'active'
      },
    }),
    {
      name: 'barpro-auth',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        token: state.token,
        refreshToken: state.refreshToken,
        effectivePermissions: state.effectivePermissions,
        sessionExpiry: state.sessionExpiry,
      }),
    }
  )
)
