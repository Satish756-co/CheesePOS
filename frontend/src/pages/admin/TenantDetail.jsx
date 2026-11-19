import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminAPI } from '@/api'
import { formatCurrency, formatDate } from '@/utils/formatters'
import toast from 'react-hot-toast'
import { ArrowLeft, Building2, Users, Store, CreditCard, X, Sliders, AlertTriangle, Clock, RotateCcw, Trash2, KeyRound, Copy, ToggleLeft, ToggleRight } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { BUSINESS_CONFIG } from '@/config/businessConfig'

const BUSINESS_TYPE_LABELS = {
  bar_restaurant: 'Bar & Restaurant',
  saloon:         'Saloon / Spa',
  daily_store:    'Daily Store',
  scanning_lab:   'Scanning Lab',
  pharmacy:       'Pharmacy',
  retail_shop:    'Retail Shop',
  hr_operations:  'HR Operations',
  other:          'Other',
}

function ActivateSubscriptionModal({ tenantId, plans, onClose, onSave }) {
  const [form, setForm] = useState({ plan_id: plans[0]?.id || '', billing_cycle: 'monthly' })
  const [saving, setSaving] = useState(false)
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const selectedPlan = plans.find(p => p.id === parseInt(form.plan_id))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ tenant_id: tenantId, ...form, plan_id: parseInt(form.plan_id) })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to activate subscription')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">Activate Subscription</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Plan *</label>
            <select className="input" value={form.plan_id} onChange={e => u('plan_id', e.target.value)} required>
              <option value="">Select plan</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Billing Cycle</label>
            <select className="input" value={form.billing_cycle} onChange={e => u('billing_cycle', e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          {selectedPlan && (
            <div className="bg-brand-50 rounded-xl p-3 text-sm">
              <p className="font-semibold text-brand-700">{selectedPlan.name}</p>
              <p className="text-brand-600">
                {form.billing_cycle === 'monthly'
                  ? formatCurrency(selectedPlan.price_monthly) + '/month'
                  : formatCurrency(selectedPlan.price_yearly) + '/year'}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {selectedPlan.max_outlets} outlets · {selectedPlan.max_users} users
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Activating...' : 'Activate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ResetPasswordResultModal({ result, onClose }) {
  const copy = () => {
    navigator.clipboard.writeText(result.temp_password)
    toast.success('Copied to clipboard')
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Password Reset</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <p className="text-sm text-gray-600 mb-1">Temporary password for <strong>{result.user_name}</strong></p>
        <p className="text-xs text-gray-400 mb-4">{result.user_email}</p>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4">
          <span className="font-mono text-lg font-bold text-gray-900 flex-1 tracking-wider">{result.temp_password}</span>
          <button onClick={copy} className="text-gray-400 hover:text-brand-600"><Copy size={16} /></button>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-5">
          Share this password with the user. They will be forced to change it on next login.
        </div>
        <button onClick={onClose} className="btn-primary w-full">Done</button>
      </div>
    </div>
  )
}

const OPTION_LABELS = {
  inventory: 'Inventory', expenses: 'Expenses', staff_users: 'Staff Accounts',
}

const RESET_OPTIONS = [
  { key: 'invoices', label: 'Sales / Invoices', desc: 'All billing records and payments' },
  { key: 'orders', label: 'Orders & KOTs', desc: 'Open/closed orders and kitchen tickets' },
  { key: 'purchases', label: 'Purchases', desc: 'Purchase orders from suppliers' },
  { key: 'inventory', label: 'Inventory', desc: 'Stock balances, ledger, transfers' },
  { key: 'expenses', label: 'Expenses', desc: 'All recorded expenses' },
  { key: 'staff_users', label: 'Staff Accounts', desc: 'Non-owner/admin user accounts' },
]

function useAdminCountdown(expiresAt) {
  const [display, setDisplay] = useState('')
  const [urgent, setUrgent] = useState(false)
  useEffect(() => {
    const calc = () => {
      const diff = new Date(expiresAt) - Date.now()
      if (diff <= 0) { setDisplay('Expired'); setUrgent(true); return }
      const totalSec = Math.floor(diff / 1000)
      const days = Math.floor(totalSec / 86400)
      const hrs  = Math.floor((totalSec % 86400) / 3600)
      const mins = Math.floor((totalSec % 3600) / 60)
      if (days >= 2) { setDisplay(`${days} days`); setUrgent(false) }
      else if (days === 1) { setDisplay(`1 day ${hrs}h ${mins}m`); setUrgent(false) }
      else { setDisplay(`${hrs}h ${String(mins).padStart(2,'0')}m`); setUrgent(true) }
    }
    calc()
    const id = setInterval(calc, 30000)
    return () => clearInterval(id)
  }, [expiresAt])
  return { display, urgent }
}

function BatchRow({ batch, tenantId, onRefresh }) {
  const { display, urgent } = useAdminCountdown(batch.expires_at)
  const tags = Object.entries(batch.options || {}).filter(([,v]) => v).map(([k]) => OPTION_LABELS[k] || k)
  const isExpired = batch.status === 'purged' || new Date(batch.expires_at) <= new Date()

  const restore = useMutation({
    mutationFn: () => adminAPI.restoreBatch(tenantId, batch.id),
    onSuccess: () => { toast.success('Data restored!'); onRefresh() },
    onError: (err) => toast.error(err.response?.data?.error || 'Restore failed'),
  })
  const purge = useMutation({
    mutationFn: () => adminAPI.purgeBatch(tenantId, batch.id),
    onSuccess: () => { toast.success('Batch permanently deleted'); onRefresh() },
    onError: (err) => toast.error(err.response?.data?.error || 'Purge failed'),
  })

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${urgent ? 'border-red-200 bg-red-50' : 'border-amber-100 bg-amber-50'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{tags.join(', ') || '—'}</p>
        <p className="text-xs text-gray-500">
          Reset {new Date(batch.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          {' · '}
          <span className={urgent ? 'text-red-600 font-semibold' : 'text-amber-700'}>
            {isExpired ? 'Expired' : `${display} left`}
          </span>
        </p>
      </div>
      {batch.status === 'active' && !isExpired && (
        <div className="flex gap-2">
          <button onClick={() => restore.mutate()} disabled={restore.isPending} title="Restore" className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50">
            <RotateCcw size={14} />
          </button>
          <button onClick={() => { if (window.confirm('Permanently delete this batch? Cannot undo.')) purge.mutate() }} disabled={purge.isPending} title="Delete permanently" className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50">
            <Trash2 size={14} />
          </button>
        </div>
      )}
      {(batch.status !== 'active' || isExpired) && (
        <span className="text-xs text-gray-400 capitalize">{batch.status}</span>
      )}
    </div>
  )
}

function AdminResetDataSection({ tenantId }) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState({})
  const [confirm, setConfirm] = useState('')
  const [open, setOpen] = useState(false)

  const { data: batches = [], refetch } = useQuery({
    queryKey: ['admin-reset-batches', tenantId],
    queryFn: () => adminAPI.listResetBatches(tenantId).then(r => r.data),
    staleTime: 30_000,
  })

  const toggle = (key) => setSelected(s => ({ ...s, [key]: !s[key] }))
  const anySelected = Object.values(selected).some(Boolean)

  const mutation = useMutation({
    mutationFn: () => adminAPI.resetTenantData(tenantId, selected, confirm),
    onSuccess: () => {
      toast.success('Selected data permanently deleted')
      qc.invalidateQueries({ queryKey: ['admin-tenant', String(tenantId)] })
      refetch()
      setSelected({})
      setConfirm('')
      setOpen(false)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Reset failed'),
  })

  const canSubmit = anySelected && confirm === 'RESET' && !mutation.isPending
  const activeBatches = batches.filter(b => b.status === 'active')

  return (
    <div className="bg-white rounded-2xl border-2 border-red-200 p-6 mt-2">
      {activeBatches.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock size={14} className="text-amber-500" /> Client Reset History — Restorable
          </p>
          <div className="space-y-2">
            {activeBatches.map(b => <BatchRow key={b.id} batch={b} tenantId={tenantId} onRefresh={refetch} />)}
          </div>
        </div>
      )}

      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 w-full text-left">
        <AlertTriangle size={18} className="text-red-500" />
        <h2 className="text-lg font-bold text-red-700 flex-1">Admin Hard Reset (Permanent)</h2>
        <span className="text-xs text-gray-400">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div className="mt-5">
          <p className="text-sm text-red-700 font-semibold mb-1">⚠ This permanently deletes data — no restore possible.</p>
          <p className="text-sm text-gray-600 mb-4">Owner and Admin accounts are never deleted.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            {RESET_OPTIONS.map(opt => (
              <label key={opt.key} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selected[opt.key] ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="checkbox" checked={!!selected[opt.key]} onChange={() => toggle(opt.key)} className="mt-0.5 accent-red-500" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          {anySelected && (
            <div className="border-t border-red-100 pt-4">
              <p className="text-sm text-red-700 mb-2">Type <strong>RESET</strong> to confirm permanent deletion:</p>
              <input type="text" className="input mb-3 max-w-xs font-mono" placeholder="RESET" value={confirm} onChange={e => setConfirm(e.target.value)} />
              <br />
              <button onClick={() => mutation.mutate()} disabled={!canSubmit} className="px-6 py-2 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {mutation.isPending ? 'Deleting…' : 'Permanently Delete'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FeatureOverridesSection({ tenantId, currentOverrides, onSaved, businessType }) {
  const qc = useQueryClient()
  const [overrides, setOverrides] = useState(() => currentOverrides || {})

  const featureList = BUSINESS_CONFIG[businessType]?.featureList || []

  const isDisabled = (key) => overrides[key] === false

  const toggle = (key) => {
    setOverrides(prev => {
      const next = { ...prev }
      if (next[key] === false) {
        delete next[key]  // remove override → enabled
      } else {
        next[key] = false  // set to false → disabled
      }
      return next
    })
  }

  const save = useMutation({
    mutationFn: () => adminAPI.updateFeatureOverrides(tenantId, overrides),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tenant', String(tenantId)] })
      toast.success('Feature settings saved')
      onSaved?.()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Save failed'),
  })

  const hasChanges = JSON.stringify(overrides) !== JSON.stringify(currentOverrides || {})

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <ToggleRight size={16} /> Feature Access
        </h2>
        <p className="text-xs text-gray-400">Toggle off to hide tab from this customer</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {featureList.map(({ key, label }) => {
          const off = isDisabled(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors
                ${off
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-green-50 border-green-200 text-green-700'
                }`}
            >
              {off
                ? <ToggleLeft size={16} className="flex-shrink-0" />
                : <ToggleRight size={16} className="flex-shrink-0" />}
              {label}
            </button>
          )
        })}
      </div>
      {hasChanges && (
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="btn-primary text-sm py-1.5 px-4"
        >
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      )}
    </div>
  )
}

export default function AdminTenantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('overview')
  const [showSubModal, setShowSubModal] = useState(false)
  const [editingLimits, setEditingLimits] = useState(false)
  const [limitsForm, setLimitsForm] = useState({})
  const [resetResult, setResetResult] = useState(null)

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['admin-tenant', id],
    queryFn: () => adminAPI.getTenant(id).then(r => r.data),
  })

  const { data: plans = [] } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => adminAPI.listPlans().then(r => r.data),
  })

  const updateTenant = useMutation({
    mutationFn: (data) => adminAPI.updateTenant(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tenant', id] }); toast.success('Updated') },
  })

  const activateSub = useMutation({
    mutationFn: (data) => adminAPI.activateSubscription(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tenant', id] })
      toast.success('Subscription activated')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  })

  const resetPassword = useMutation({
    mutationFn: (userId) => adminAPI.resetUserPassword(parseInt(id), userId),
    onSuccess: (res) => setResetResult(res.data),
    onError: (err) => toast.error(err.response?.data?.error || 'Reset failed'),
  })

  if (isLoading) return <div className="p-6 text-center text-gray-400">Loading...</div>
  if (!tenant) return <div className="p-6 text-center text-gray-400">Tenant not found</div>

  const sub = tenant.subscription

  const handleSaveLimits = (e) => {
    e.preventDefault()
    updateTenant.mutate({
      custom_max_outlets: limitsForm.custom_max_outlets === '' ? null : parseInt(limitsForm.custom_max_outlets),
      custom_max_users: limitsForm.custom_max_users === '' ? null : parseInt(limitsForm.custom_max_users),
    }, { onSuccess: () => setEditingLimits(false) })
  }

  const STATUS_COLORS = {
    active: 'badge-green', trial: 'badge-blue', suspended: 'badge-red',
    expired: 'badge-red', cancelled: 'badge-gray',
  }

  return (
    <div className="p-4 md:p-6">
      <button onClick={() => navigate('/admin/tenants')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 text-sm">
        <ArrowLeft size={16} /> Back to Tenants
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tenant.business_name}</h1>
          <p className="text-gray-500 text-sm">{tenant.email}</p>
        </div>
        <div className="flex gap-2">
          <span className={`badge ${STATUS_COLORS[tenant.status] || 'badge-gray'} capitalize`}>{tenant.status}</span>
          {tenant.status !== 'active' && (
            <button onClick={() => updateTenant.mutate({ status: 'active' })} className="btn-primary text-sm py-1.5 px-3">
              Activate
            </button>
          )}
          {tenant.status === 'active' && (
            <button onClick={() => updateTenant.mutate({ status: 'suspended' })} className="btn-secondary text-sm py-1.5 px-3 text-red-600 border-red-200 hover:bg-red-50">
              Suspend
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {[['overview', 'Overview'], ['outlets', 'Outlets'], ['users', 'Users'], ['subscription', 'Subscription']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Building2 size={16} /> Business Details</h2>
            <div className="space-y-3 text-sm">
              {[
                ['Business Name', tenant.business_name],
                ['Business Type', tenant.business_type ? (BUSINESS_TYPE_LABELS[tenant.business_type] || tenant.business_type) : null],
                ['Email', tenant.email],
                ['Phone', tenant.phone],
                ['City', tenant.city],
                ['State', tenant.state],
                ['GSTIN', tenant.gstin],
                ['Registered', formatDate(tenant.created_at)],
              ].map(([label, value]) => value ? (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ) : null)}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><CreditCard size={16} /> Subscription</h2>            {sub ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Plan</span><span className="font-bold">{sub.plan_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`badge ${STATUS_COLORS[sub.status] || 'badge-gray'} capitalize`}>{sub.status}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Cycle</span><span className="capitalize">{sub.billing_cycle}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium">{formatCurrency(sub.amount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Expires</span><span>{formatDate(sub.ends_at)}</span></div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <p className="mb-3">No active subscription</p>
                <button onClick={() => setShowSubModal(true)} className="btn-primary text-sm">Activate Subscription</button>
              </div>
            )}
            {sub && (
              <button onClick={() => setShowSubModal(true)} className="btn-secondary w-full mt-4 text-sm">
                Change / Renew Subscription
              </button>
            )}
          </div>

          {/* Custom Limits */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2"><Sliders size={16} /> Custom Limits</h2>              {!editingLimits && (
                <button
                  onClick={() => {
                    setLimitsForm({
                      custom_max_outlets: tenant.custom_max_outlets ?? '',
                      custom_max_users: tenant.custom_max_users ?? '',
                    })
                    setEditingLimits(true)
                  }}
                  className="text-gray-400 hover:text-brand-500 text-sm"
                >
                  Edit
                </button>
              )}
            </div>
            {editingLimits ? (
              <form onSubmit={handleSaveLimits} className="flex flex-wrap gap-6">
                <div>
                  <label className="label">
                    Max Outlets
                    <span className="text-gray-400 font-normal ml-1">(plan default: {sub?.plan?.max_outlets ?? '—'})</span>
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      className="input w-24"
                      min={1}
                      max={100}
                      value={limitsForm.custom_max_outlets}
                      onChange={e => setLimitsForm(f => ({ ...f, custom_max_outlets: e.target.value }))}
                      placeholder="plan default"
                    />
                    {limitsForm.custom_max_outlets !== '' && (
                      <button type="button" onClick={() => setLimitsForm(f => ({ ...f, custom_max_outlets: '' }))} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="label">
                    Max Users
                    <span className="text-gray-400 font-normal ml-1">(plan default: {sub?.plan?.max_users ?? '—'})</span>
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      className="input w-24"
                      min={1}
                      max={500}
                      value={limitsForm.custom_max_users}
                      onChange={e => setLimitsForm(f => ({ ...f, custom_max_users: e.target.value }))}
                      placeholder="plan default"
                    />
                    {limitsForm.custom_max_users !== '' && (
                      <button type="button" onClick={() => setLimitsForm(f => ({ ...f, custom_max_users: '' }))} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
                    )}
                  </div>
                </div>
                <div className="w-full">
                  <p className="text-xs text-gray-400 mb-3">Leave blank to use plan defaults. Custom limits override the subscription plan's limits.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingLimits(false)} className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1">
                      <X size={14} /> Cancel
                    </button>
                    <button type="submit" disabled={updateTenant.isPending} className="btn-primary text-sm py-1.5 px-3">
                      {updateTenant.isPending ? 'Saving…' : 'Save Limits'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="flex gap-10 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Max Outlets</p>
                  {tenant.custom_max_outlets != null ? (
                    <span className="font-bold text-brand-600 text-lg">{tenant.custom_max_outlets} <span className="text-xs font-normal text-gray-400">custom</span></span>
                  ) : (
                    <span className="text-gray-400">Plan default ({sub?.plan?.max_outlets ?? '—'})</span>
                  )}
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Max Users</p>
                  {tenant.custom_max_users != null ? (
                    <span className="font-bold text-brand-600 text-lg">{tenant.custom_max_users} <span className="text-xs font-normal text-gray-400">custom</span></span>
                  ) : (
                    <span className="text-gray-400">Plan default ({sub?.plan?.max_users ?? '—'})</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
          <FeatureOverridesSection
            tenantId={parseInt(id)}
            currentOverrides={tenant.feature_overrides}
            businessType={tenant.business_type}
            onSaved={() => qc.invalidateQueries({ queryKey: ['admin-tenant', id] })}
          />
        <AdminResetDataSection tenantId={parseInt(id)} />
        </>
      )}

      {tab === 'outlets' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Outlet Name</th>
                <th className="table-header">Code</th>
                <th className="table-header">Type</th>
                <th className="table-header">City</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(tenant.outlets || []).map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{o.name}</td>
                  <td className="table-cell font-mono text-sm text-gray-500">{o.outlet_code}</td>
                  <td className="table-cell text-sm text-gray-600 capitalize">{o.outlet_type?.replace('_', ' ')}</td>
                  <td className="table-cell text-sm text-gray-500">{o.city || '—'}</td>
                  <td className="table-cell">
                    <span className={`badge ${o.is_active ? 'badge-green' : 'badge-red'}`}>{o.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!tenant.outlets?.length && <div className="text-center py-8 text-gray-400">No outlets yet</div>}
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Role</th>
                <th className="table-header">Status</th>
                <th className="table-header">Joined</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(tenant.users || []).map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{u.first_name} {u.last_name}</td>
                  <td className="table-cell text-sm text-gray-500">{u.email}</td>
                  <td className="table-cell"><span className="badge badge-blue capitalize">{u.role}</span></td>
                  <td className="table-cell"><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="table-cell text-sm text-gray-500">{formatDate(u.created_at)}</td>
                  <td className="table-cell">
                    <button
                      onClick={() => { if (window.confirm(`Reset password for ${u.first_name} ${u.last_name}?`)) resetPassword.mutate(u.id) }}
                      disabled={resetPassword.isPending}
                      title="Reset password"
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 disabled:opacity-50"
                    >
                      <KeyRound size={13} /> Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!tenant.users?.length && <div className="text-center py-8 text-gray-400">No users yet</div>}
        </div>
      )}

      {tab === 'subscription' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowSubModal(true)} className="btn-primary flex items-center gap-2">
              <CreditCard size={16} /> {sub ? 'Change Subscription' : 'Activate Subscription'}
            </button>
          </div>
          {sub ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 max-w-sm">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Plan</span><span className="font-bold text-lg">{sub.plan_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`badge ${STATUS_COLORS[sub.status] || 'badge-gray'} capitalize`}>{sub.status}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Billing</span><span className="capitalize">{sub.billing_cycle}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium">{formatCurrency(sub.amount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Started</span><span>{formatDate(sub.starts_at)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Expires</span><span>{formatDate(sub.ends_at)}</span></div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">No active subscription</div>
          )}
        </div>
      )}

      {showSubModal && (
        <ActivateSubscriptionModal
          tenantId={parseInt(id)}
          plans={plans}
          onClose={() => setShowSubModal(false)}
          onSave={activateSub.mutateAsync}
        />
      )}

      {resetResult && (
        <ResetPasswordResultModal result={resetResult} onClose={() => setResetResult(null)} />
      )}
    </div>
  )
}
