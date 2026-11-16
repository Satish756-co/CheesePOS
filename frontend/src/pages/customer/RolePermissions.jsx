import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { roleConfigAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import {
  Shield, LayoutDashboard, Receipt, Table2, ShoppingCart, ChefHat,
  Package, Warehouse, Truck, TrendingDown, BarChart2, Users,
  Store, ClipboardList, RotateCcw, Save, CheckCircle2, XCircle, Info, Lock
} from 'lucide-react'

// ─── Permission definitions ───────────────────────────────────────────────────

const PAGES = [
  { key: 'dashboard',    label: 'Dashboard',       icon: LayoutDashboard },
  { key: 'billing',      label: 'Counter Billing',  icon: Receipt },
  { key: 'table_billing',label: 'Table Billing',    icon: Table2 },
  { key: 'orders',       label: 'Orders',           icon: ShoppingCart },
  { key: 'tables',       label: 'Tables',           icon: Table2 },
  { key: 'sales_log',    label: 'Sales Log',        icon: ClipboardList },
  { key: 'kot',          label: 'Kitchen / KOT',    icon: ChefHat },
  { key: 'products',     label: 'Products',         icon: Package },
  { key: 'inventory',    label: 'Inventory',        icon: Warehouse },
  { key: 'purchases',    label: 'Purchases',        icon: Truck },
  { key: 'expenses',     label: 'Expenses',         icon: TrendingDown },
  { key: 'reports',      label: 'Reports',          icon: BarChart2 },
  { key: 'users',        label: 'Users & Roles',    icon: Users },
  { key: 'roles',        label: 'Role Permissions', icon: Shield },
  { key: 'outlets',      label: 'Outlets',          icon: Store },
]

const ACTION_GROUPS = [
  {
    label: 'Billing',
    actions: [
      { key: 'billing.view',        label: 'View bills & invoices' },
      { key: 'billing.create',      label: 'Create new bill' },
      { key: 'billing.cancel_own',  label: 'Cancel own bills' },
      { key: 'billing.cancel',      label: 'Cancel any bill' },
      { key: 'billing.discount',    label: 'Apply discounts' },
    ],
  },
  {
    label: 'Orders & Tables',
    actions: [
      { key: 'orders.view',   label: 'View orders' },
      { key: 'orders.create', label: 'Create / add items to order' },
      { key: 'orders.edit',   label: 'Edit order items' },
      { key: 'orders.cancel', label: 'Cancel orders' },
      { key: 'tables.view',   label: 'View table status' },
      { key: 'tables.update', label: 'Update table status' },
    ],
  },
  {
    label: 'Kitchen',
    actions: [
      { key: 'kot.view',   label: 'View KOT tickets' },
      { key: 'kot.update', label: 'Update KOT status' },
    ],
  },
  {
    label: 'Inventory & Purchases',
    actions: [
      { key: 'inventory.view',      label: 'View stock levels' },
      { key: 'inventory.adjust',    label: 'Adjust stock' },
      { key: 'purchases.view',      label: 'View purchase orders' },
      { key: 'purchases.create',    label: 'Create purchase orders' },
      { key: 'purchases.approve',   label: 'Approve purchases' },
      { key: 'purchases.receive',   label: 'Mark purchases as received' },
    ],
  },
  {
    label: 'Expenses',
    actions: [
      { key: 'expenses.view',    label: 'View expenses' },
      { key: 'expenses.create',  label: 'Record new expenses' },
      { key: 'expenses.approve', label: 'Approve expenses' },
    ],
  },
  {
    label: 'Reports',
    actions: [
      { key: 'reports.view',   label: 'View reports & analytics' },
      { key: 'reports.export', label: 'Export data to Excel (all pages)' },
    ],
  },
  {
    label: 'Users',
    actions: [
      { key: 'users.view',   label: 'View staff list' },
      { key: 'users.create', label: 'Add new users' },
      { key: 'users.edit',   label: 'Edit user details & roles' },
    ],
  },
]

const APPROVAL_OPTIONS = [
  { key: 'billing.cancel',       label: 'Bill cancellation requires manager approval' },
  { key: 'billing.discount_high',label: 'Discount above 10% requires manager approval' },
  { key: 'orders.cancel',        label: 'Order cancellation requires manager approval' },
  { key: 'expenses.create',      label: 'Recording expenses requires approval' },
  { key: 'purchases.approve',    label: 'Purchase orders require manager approval' },
]

const DATA_SCOPES = [
  { value: 'own',    label: 'Own records only',    desc: 'Can only see records they personally created' },
  { value: 'outlet', label: 'Assigned outlet',     desc: 'Can see all records for their assigned outlet(s)' },
  { value: 'all',    label: 'All records',          desc: 'Full visibility across all outlets' },
]

const CONFIGURABLE_ROLES = [
  { key: 'owner',             label: 'Owner',           locked: true },
  { key: 'admin',             label: 'Admin' },
  { key: 'manager',           label: 'Manager' },
  { key: 'cashier',           label: 'Cashier' },
  { key: 'waiter',            label: 'Waiter' },
  { key: 'kitchen',           label: 'Kitchen Staff' },
  { key: 'inventory_manager', label: 'Inventory Manager' },
  { key: 'accountant',        label: 'Accountant' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0
        ${checked ? 'bg-brand-500' : 'bg-gray-200'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
        ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function SectionCard({ title, children, badge }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        {badge && <span className="text-xs text-gray-400">{badge}</span>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RolePermissions() {
  const queryClient = useQueryClient()
  const { refreshPermissions, user } = useAuthStore()
  const [activeRole, setActiveRole] = useState('owner')
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)

  const activeRoleMeta = CONFIGURABLE_ROLES.find(r => r.key === activeRole)
  const isLocked = !!activeRoleMeta?.locked

  const { data: allConfigs, isLoading } = useQuery({
    queryKey: ['role-configs'],
    queryFn: () => roleConfigAPI.list().then(r => r.data),
  })

  // When role or server data changes, reset draft to server config
  useEffect(() => {
    if (activeRole === 'owner') {
      setDraft({ pages: ['*'], actions: ['*'], approvals: [], data_scope: 'all' })
      setDirty(false)
    } else if (allConfigs?.[activeRole]) {
      setDraft({ ...allConfigs[activeRole] })
      setDirty(false)
    }
  }, [activeRole, allConfigs])

  const saveMutation = useMutation({
    mutationFn: (data) => roleConfigAPI.update(activeRole, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-configs'] })
      toast.success('Role permissions saved')
      setDirty(false)
      // If the saved role matches the current user's role, refresh their live permissions
      if (user?.role === activeRole) refreshPermissions()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save'),
  })

  const resetMutation = useMutation({
    mutationFn: () => roleConfigAPI.reset(activeRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-configs'] })
      toast.success('Reset to system defaults')
      if (user?.role === activeRole) refreshPermissions()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to reset'),
  })

  const update = (patch) => {
    setDraft(prev => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const togglePage = (key) => {
    const pages = draft.pages || []
    update({ pages: pages.includes(key) ? pages.filter(p => p !== key) : [...pages, key] })
  }

  const toggleAction = (key) => {
    const actions = draft.actions || []
    update({ actions: actions.includes(key) ? actions.filter(a => a !== key) : [...actions, key] })
  }

  const toggleApproval = (key) => {
    const approvals = draft.approvals || []
    update({ approvals: approvals.includes(key) ? approvals.filter(a => a !== key) : [...approvals, key] })
  }

  if (isLoading || !draft) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-gray-400">
        Loading role configurations…
      </div>
    )
  }

  const isWildcard = draft.pages?.includes('*')

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={22} className="text-brand-500" /> Roles & Permissions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure what each role can see and do. Changes apply to all users with that role.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => resetMutation.mutate()}
            disabled={isLocked || resetMutation.isPending}
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} /> Reset defaults
          </button>
          <button
            onClick={() => saveMutation.mutate(draft)}
            disabled={isLocked || !dirty || saveMutation.isPending}
            className={`btn-primary flex items-center gap-1.5 text-sm
              ${(isLocked || !dirty) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Save size={14} /> {saveMutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Role tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 flex-wrap">
        {CONFIGURABLE_ROLES.map(r => (
          <button
            key={r.key}
            onClick={() => {
              if (dirty) {
                if (!window.confirm('Discard unsaved changes?')) return
              }
              setActiveRole(r.key)
            }}
            className={`flex-1 min-w-fit px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5
              ${activeRole === r.key
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            {r.locked && <Lock size={11} className="opacity-60" />}
            {r.label}
          </button>
        ))}
      </div>

      {isLocked && (
        <div className="mb-4 flex items-center gap-2 text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-4 py-3">
          <Lock size={14} className="flex-shrink-0" />
          <span><strong>Owner</strong> always has full access to all pages and actions. These permissions are permanent and cannot be changed by anyone.</span>
        </div>
      )}

      {dirty && (
        <div className="mb-4 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Info size={13} /> Unsaved changes — click "Save changes" to apply
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Pages / Tabs */}
        <SectionCard
          title="Pages & Sidebar Tabs"
          badge={isWildcard ? 'All pages' : `${(draft.pages || []).length} of ${PAGES.length} enabled`}
        >
          {isWildcard ? (
            <p className="text-sm text-gray-500 italic">Full access — all pages are visible</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {PAGES.map(page => {
                const Icon = page.icon
                const on = (draft.pages || []).includes(page.key)
                return (
                  <label key={page.key}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors
                      ${on ? 'border-brand-200 bg-brand-50' : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <Toggle checked={on} onChange={() => togglePage(page.key)} disabled={isLocked} />
                    <Icon size={14} className={on ? 'text-brand-500' : 'text-gray-400'} />
                    <span className={`text-xs font-medium ${on ? 'text-brand-700' : 'text-gray-500'}`}>
                      {page.label}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Data Scope */}
        <div className="space-y-4">
          <SectionCard title="Data Visibility">
            <div className="space-y-2">
              {DATA_SCOPES.map(scope => (
                <label key={scope.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors
                    ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                    ${draft.data_scope === scope.value
                      ? 'border-brand-300 bg-brand-50'
                      : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <input
                    type="radio"
                    name="data_scope"
                    value={scope.value}
                    checked={draft.data_scope === scope.value}
                    disabled={isLocked}
                    onChange={() => !isLocked && update({ data_scope: scope.value })}
                    className="mt-0.5 accent-brand-500"
                  />
                  <div>
                    <p className={`text-sm font-medium ${draft.data_scope === scope.value ? 'text-brand-700' : 'text-gray-700'}`}>
                      {scope.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{scope.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </SectionCard>

          {/* Approvals */}
          <SectionCard title="Approval Requirements">
            <p className="text-xs text-gray-400 mb-3">
              Checked actions will require a manager to approve before completing
            </p>
            <div className="space-y-2">
              {APPROVAL_OPTIONS.map(opt => {
                const on = (draft.approvals || []).includes(opt.key)
                return (
                  <label key={opt.key}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors
                      ${on ? 'border-orange-200 bg-orange-50' : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <Toggle checked={on} onChange={() => toggleApproval(opt.key)} disabled={isLocked} />
                    <span className={`text-xs ${on ? 'text-orange-700 font-medium' : 'text-gray-600'}`}>
                      {opt.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </SectionCard>
        </div>

        {/* Actions — full width */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Actions & Capabilities"
            badge={isWildcard ? 'All actions' : `${(draft.actions || []).length} actions allowed`}
          >
            {isWildcard ? (
              <p className="text-sm text-gray-500 italic">Full access — all actions are permitted</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
                {ACTION_GROUPS.map(group => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.label}</p>
                    <div className="space-y-1.5">
                      {group.actions.map(action => {
                        const on = (draft.actions || []).includes(action.key)
                        const needsApproval = (draft.approvals || []).includes(action.key)
                        return (
                          <label key={action.key}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors
                              ${on ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                          >
                            <Toggle checked={on} onChange={() => toggleAction(action.key)} disabled={isLocked} />
                            <span className={`text-xs flex-1 ${on ? 'text-gray-800' : 'text-gray-400'}`}>
                              {action.label}
                            </span>
                            {on && needsApproval && (
                              <span className="text-xs text-orange-500 font-medium">needs approval</span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

      </div>

      {/* Summary */}
      <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-500">
        <span className="font-medium text-gray-700">Note:</span> Owner and super-admin always have full access regardless of these settings.
        Changes take effect the next time affected users log in.
      </div>
    </div>
  )
}
