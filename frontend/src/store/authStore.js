import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/api/client'
import { BUSINESS_CONFIG } from '@/config/businessConfig'

// Derive FALLBACK_ROLE_PAGES by unioning pages from every business type config.
// This is used only before effectivePermissions loads from the backend.
function buildFallbackRolePages() {
  const result = { owner: ['*'] }
  const roles = ['admin', 'manager', 'cashier', 'waiter', 'kitchen', 'inventory_manager', 'accountant']
  for (const role of roles) {
    const pageSet = new Set()
    for (const config of Object.values(BUSINESS_CONFIG)) {
      for (const p of config.fallbackPages?.[role] || []) pageSet.add(p)
    }
    result[role] = [...pageSet]
  }
  return result
}

const FALLBACK_ROLE_PAGES = buildFallbackRolePages()

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      token: null,
      refreshToken: null,
      effectivePermissions: null,
      sessionExpiry: null,
      businesses: [],

      setAuth: (user, tenant, token, refreshToken, effectivePermissions = null, businesses = []) =>
        set({ user, tenant, token, refreshToken, effectivePermissions, sessionExpiry: Date.now() + 4 * 60 * 60 * 1000, businesses }),

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
          // Guard against race: if the response's tenant differs from the current
          // tenant (e.g. switchBusiness fired while this request was in-flight),
          // discard the stale response rather than overwriting the new tenant.
          const currentTenantId = get().tenant?.id
          const freshTenantId = data.tenant?.id
          if (currentTenantId && freshTenantId && currentTenantId !== freshTenantId) return
          set({
            user: data.user ?? get().user,
            tenant: data.tenant ?? get().tenant,
            effectivePermissions: data.effective_permissions ?? get().effectivePermissions,
            businesses: data.businesses ?? get().businesses,
          })
        } catch (err) {
          // On 401/403 the session is invalid — log out immediately
          if (err?.response?.status === 401 || err?.response?.status === 403) {
            get().logout()
          }
          // For network errors or 5xx, retain stale permissions
        }
      },

      logout: () => set({ user: null, tenant: null, token: null, refreshToken: null, effectivePermissions: null, sessionExpiry: null, businesses: [] }),

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

        const perms = get().effectivePermissions

        // Admin can disable features tenant-wide — blocks all roles including owner
        const disabled = perms?.disabled_features ?? []
        const permList = Array.isArray(permission) ? permission : [permission]
        if (permList.every(p => disabled.includes(p))) return false

        if (user.role === 'owner') return true

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

        const businessType = state.tenant?.business_type

        const orderedPages = BUSINESS_CONFIG[businessType]?.orderedPages || []

        for (const { path, permission } of orderedPages) {
          if (state.hasPermission(permission)) return path
        }
        return '/app/settings'
      },

      switchBusiness: async (tenantId) => {
        const res = await api.post('/auth/switch-business', { tenant_id: tenantId })
        const d = res.data
        get().setAuth(d.user, d.tenant, d.access_token, d.refresh_token, d.effective_permissions, d.businesses ?? [])
      },

      isSubscriptionActive: () => {        const tenant = get().tenant
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
        businesses: state.businesses,
      }),
    }
  )
)
