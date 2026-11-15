import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminAPI } from '@/api'
import { formatCurrency } from '@/utils/formatters'
import toast from 'react-hot-toast'
import { Plus, Edit2, X, Package, Check } from 'lucide-react'

const FEATURE_KEYS = [
  { key: 'kot', label: 'KOT (Kitchen Order Ticket)' },
  { key: 'inventory', label: 'Inventory Management' },
  { key: 'purchases', label: 'Purchase Management' },
  { key: 'reports', label: 'Advanced Reports' },
  { key: 'expenses', label: 'Expense Tracking' },
  { key: 'multi_outlet', label: 'Multi-Outlet Support' },
  { key: 'api_access', label: 'API Access' },
]

function PlanModal({ plan, onClose, onSave }) {
  const [form, setForm] = useState(plan ? {
    name: plan.name,
    slug: plan.slug,
    description: plan.description || '',
    price_monthly: plan.price_monthly,
    price_yearly: plan.price_yearly,
    max_outlets: plan.max_outlets,
    max_users: plan.max_users,
    features: plan.features || {},
    display_order: plan.display_order || 0,
  } : {
    name: '', slug: '', description: '',
    price_monthly: '', price_yearly: '',
    max_outlets: 1, max_users: 5,
    features: {}, display_order: 0,
  })
  const [saving, setSaving] = useState(false)
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleFeature = (key) => {
    u('features', { ...form.features, [key]: !form.features[key] })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">{plan ? 'Edit Plan' : 'Create Plan'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Plan Name *</label>
              <input className="input" value={form.name} onChange={e => {
                u('name', e.target.value)
                if (!plan) u('slug', e.target.value.toLowerCase().replace(/\s+/g, '_'))
              }} required placeholder="e.g. Pro Plan" />
            </div>
            <div>
              <label className="label">Slug *</label>
              <input className="input" value={form.slug} onChange={e => u('slug', e.target.value)} required placeholder="e.g. pro_plan" />
            </div>
            <div>
              <label className="label">Display Order</label>
              <input type="number" className="input" value={form.display_order} onChange={e => u('display_order', parseInt(e.target.value))} min="0" />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none h-16" value={form.description} onChange={e => u('description', e.target.value)} placeholder="Plan description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Monthly Price (₹) *</label>
              <input type="number" className="input" value={form.price_monthly} onChange={e => u('price_monthly', e.target.value)} required min="0" step="0.01" />
            </div>
            <div>
              <label className="label">Yearly Price (₹) *</label>
              <input type="number" className="input" value={form.price_yearly} onChange={e => u('price_yearly', e.target.value)} required min="0" step="0.01" />
            </div>
            <div>
              <label className="label">Max Outlets</label>
              <input type="number" className="input" value={form.max_outlets} onChange={e => u('max_outlets', parseInt(e.target.value))} min="1" />
            </div>
            <div>
              <label className="label">Max Users</label>
              <input type="number" className="input" value={form.max_users} onChange={e => u('max_users', parseInt(e.target.value))} min="1" />
            </div>
          </div>
          <div>
            <label className="label">Features</label>
            <div className="grid grid-cols-2 gap-2">
              {FEATURE_KEYS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!form.features[key]} onChange={() => toggleFeature(key)} />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminPlans() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editPlan, setEditPlan] = useState(null)

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => adminAPI.listPlans().then(r => r.data),
  })

  const createPlan = useMutation({
    mutationFn: (data) => adminAPI.createPlan(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-plans'] }); toast.success('Plan created') },
  })
  const updatePlan = useMutation({
    mutationFn: ({ id, data }) => adminAPI.updatePlan(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-plans'] }); toast.success('Plan updated') },
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
          <p className="text-sm text-gray-500">Manage subscription plans</p>
        </div>
        <button onClick={() => { setEditPlan(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Create Plan
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600">No plans yet</p>
          <button onClick={() => { setEditPlan(null); setShowModal(true) }} className="btn-primary mt-4">Create First Plan</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <span className="text-xs font-mono text-gray-400">{plan.slug}</span>
                </div>
                <button onClick={() => { setEditPlan(plan); setShowModal(true) }} className="text-gray-400 hover:text-brand-500">
                  <Edit2 size={15} />
                </button>
              </div>
              {plan.description && <p className="text-sm text-gray-500 mb-3">{plan.description}</p>}
              <div className="space-y-1 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Monthly</span>
                  <span className="font-bold text-gray-900">{formatCurrency(plan.price_monthly)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Yearly</span>
                  <span className="font-medium">{formatCurrency(plan.price_yearly)}</span>
                </div>
              </div>
              <div className="flex gap-3 text-sm text-gray-600 mb-3 bg-gray-50 rounded-xl p-3">
                <span><strong>{plan.max_outlets}</strong> outlets</span>
                <span>·</span>
                <span><strong>{plan.max_users}</strong> users</span>
              </div>
              {plan.features && Object.keys(plan.features).length > 0 && (
                <div className="space-y-1">
                  {FEATURE_KEYS.filter(f => plan.features[f.key]).map(f => (
                    <div key={f.key} className="flex items-center gap-2 text-xs text-gray-600">
                      <Check size={12} className="text-green-500 flex-shrink-0" />
                      {f.label}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className={`badge ${plan.is_active ? 'badge-green' : 'badge-red'}`}>
                  {plan.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PlanModal
          plan={editPlan}
          onClose={() => setShowModal(false)}
          onSave={data => editPlan
            ? updatePlan.mutateAsync({ id: editPlan.id, data })
            : createPlan.mutateAsync(data)
          }
        />
      )}
    </div>
  )
}
