import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Tag, X, Store } from 'lucide-react'
import { salonAPI, outletsAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

function CouponModal({ coupon, outlets, onClose, onSave }) {
  const [form, setForm] = useState({
    code:               coupon?.code || '',
    name:               coupon?.name || '',
    discount_type:      coupon?.discount_type || 'percent',
    discount_value:     coupon?.discount_value || '',
    min_bill_amount:    coupon?.min_bill_amount || '',
    max_discount:       coupon?.max_discount || '',
    valid_from:         coupon?.valid_from || '',
    valid_until:        coupon?.valid_until || '',
    usage_limit:        coupon?.usage_limit || '',
    is_active:          coupon?.is_active !== false,
    outlet_id:          coupon?.outlet_id || '',
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.code.trim()) return toast.error('Coupon code is required')
    if (!form.discount_value || isNaN(Number(form.discount_value))) return toast.error('Valid discount value is required')
    setLoading(true)
    try {
      await onSave({
        ...form,
        code: form.code.trim().toUpperCase(),
        discount_value: Number(form.discount_value),
        min_bill_amount: form.min_bill_amount ? Number(form.min_bill_amount) : 0,
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        outlet_id: form.outlet_id ? Number(form.outlet_id) : null,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{coupon ? 'Edit Coupon' : 'New Coupon'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Coupon Code</label>
              <input
                className="input uppercase"
                placeholder="e.g. HAIR20"
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                disabled={!!coupon}
              />
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="e.g. 20% Hair Discount" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
          </div>

          {/* Outlet assignment */}
          {outlets && outlets.length > 1 && (
            <div>
              <label className="label flex items-center gap-1.5">
                <Store size={13} className="text-gray-400" />
                Outlet
              </label>
              <select
                className="input"
                value={form.outlet_id}
                onChange={e => set('outlet_id', e.target.value)}
              >
                <option value="">All Outlets</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                "All Outlets" = valid everywhere. Pick one to restrict to that outlet only.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Discount Type</label>
              <select className="input" value={form.discount_type} onChange={e => set('discount_type', e.target.value)}>
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="label">Value ({form.discount_type === 'percent' ? '%' : '₹'})</label>
              <input className="input" type="number" min="0" value={form.discount_value} onChange={e => set('discount_value', e.target.value)} />
            </div>
          </div>

          {form.discount_type === 'percent' && (
            <div>
              <label className="label">Max Discount (₹) <span className="text-gray-400 text-xs">(optional cap)</span></label>
              <input className="input" type="number" min="0" value={form.max_discount} onChange={e => set('max_discount', e.target.value)} placeholder="No cap" />
            </div>
          )}

          <div>
            <label className="label">Min Bill Amount (₹) <span className="text-gray-400 text-xs">(optional)</span></label>
            <input className="input" type="number" min="0" value={form.min_bill_amount} onChange={e => set('min_bill_amount', e.target.value)} placeholder="0" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valid From <span className="text-gray-400 text-xs">(optional)</span></label>
              <input className="input" type="date" value={form.valid_from} onChange={e => set('valid_from', e.target.value)} />
            </div>
            <div>
              <label className="label">Valid Until <span className="text-gray-400 text-xs">(optional)</span></label>
              <input className="input" type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Usage Limit <span className="text-gray-400 text-xs">(optional — blank = unlimited)</span></label>
            <input className="input" type="number" min="1" value={form.usage_limit} onChange={e => set('usage_limit', e.target.value)} placeholder="Unlimited" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
            Active
          </label>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={loading} className="btn-primary flex-1">{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

export default function SalonCoupons() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editCoupon, setEditCoupon] = useState(null)

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['salon-coupons', tenant?.id],
    queryFn: () => salonAPI.listCoupons().then(r => r.data),
    enabled: !!tenant?.id,
  })

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletsAPI.list().then(r => r.data),
    enabled: !!tenant?.id,
  })

  const createMutation = useMutation({
    mutationFn: (data) => salonAPI.createCoupon(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salon-coupons'] }); toast.success('Coupon created') },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create coupon'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => salonAPI.updateCoupon(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salon-coupons'] }); toast.success('Coupon updated') },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update coupon'),
  })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  const getCouponStatus = (coupon) => {
    if (!coupon.is_active) return { label: 'Inactive', cls: 'bg-gray-100 text-gray-500' }
    if (coupon.valid_until && coupon.valid_until < today) return { label: 'Expired', cls: 'bg-red-50 text-red-700' }
    if (coupon.valid_from && coupon.valid_from > today) return { label: 'Upcoming', cls: 'bg-blue-50 text-blue-700' }
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) return { label: 'Used up', cls: 'bg-orange-50 text-orange-700' }
    return { label: 'Active', cls: 'bg-green-50 text-green-700' }
  }

  const showOutletCol = outlets.length > 1

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag size={24} />
            Coupons
          </h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage discount coupons for your salon</p>
        </div>
        <button onClick={() => { setEditCoupon(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Coupon
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-xl">
          <Tag size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No coupons yet</p>
          <p className="text-gray-400 text-sm mt-1">Create a coupon to offer discounts at the billing screen</p>
          <button onClick={() => { setEditCoupon(null); setShowModal(true) }} className="btn-primary mt-4 text-sm">
            Create First Coupon
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Discount</th>
                {showOutletCol && (
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Outlet</th>
                )}
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Validity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Usage</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.map(coupon => {
                const status = getCouponStatus(coupon)
                return (
                  <tr key={coupon.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-gray-900">{coupon.code}</p>
                      {coupon.name && <p className="text-xs text-gray-400 mt-0.5">{coupon.name}</p>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {coupon.discount_type === 'percent'
                        ? `${coupon.discount_value}%${coupon.max_discount ? ` (max ₹${coupon.max_discount})` : ''}`
                        : `₹${Number(coupon.discount_value).toFixed(2)}`
                      }
                      {coupon.min_bill_amount > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">Min bill: ₹{coupon.min_bill_amount}</p>
                      )}
                    </td>
                    {showOutletCol && (
                      <td className="px-4 py-3">
                        {coupon.outlet_name ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                            <Store size={10} />
                            {coupon.outlet_name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">All outlets</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-500">
                      {coupon.valid_from || coupon.valid_until
                        ? `${coupon.valid_from || '—'} to ${coupon.valid_until || '—'}`
                        : <span className="text-gray-300">No limit</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {coupon.used_count || 0}
                      {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setEditCoupon(coupon); setShowModal(true) }}
                        className="text-gray-400 hover:text-gray-700 p-1"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CouponModal
          coupon={editCoupon}
          outlets={outlets}
          onClose={() => setShowModal(false)}
          onSave={(data) => editCoupon
            ? updateMutation.mutateAsync({ id: editCoupon.id, data })
            : createMutation.mutateAsync(data)
          }
        />
      )}
    </div>
  )
}
