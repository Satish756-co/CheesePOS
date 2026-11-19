import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Scissors, Plus, Minus, Trash2, Tag, X, Store, ChevronDown } from 'lucide-react'
import { salonAPI, usersAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { useUserOutlets } from '@/hooks/useUserOutlets'
import toast from 'react-hot-toast'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi',  label: 'UPI' },
  { value: 'card', label: 'Card' },
]

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toFixed(2)}`
}

function ServiceCard({ item, onAdd }) {
  return (
    <button
      onClick={() => onAdd(item)}
      className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-brand-400 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
          {item.duration_minutes && (
            <p className="text-xs text-gray-400 mt-0.5">{item.duration_minutes} min</p>
          )}
          {item.services?.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              {item.services.map(s => s.service_name).join(' · ')}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold text-brand-600">{formatCurrency(item.price)}</p>
          <div className="mt-1 w-6 h-6 bg-brand-50 rounded-full flex items-center justify-center ml-auto">
            <Plus size={12} className="text-brand-600" />
          </div>
        </div>
      </div>
    </button>
  )
}

function AvailableCoupons({ coupons, subtotal, onApply, appliedCode }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const eligible = coupons.filter(c => {
    if (!c.is_active) return false
    if (c.valid_until && c.valid_until < today) return false
    if (c.valid_from && c.valid_from > today) return false
    if (c.usage_limit && c.used_count >= c.usage_limit) return false
    return true
  })

  if (eligible.length === 0) return null

  return (
    <div>
      <label className="label flex items-center gap-1.5">
        <Tag size={12} className="text-gray-400" />
        Available Coupons
      </label>
      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
        {eligible.map(c => {
          const isApplied = appliedCode === c.code
          const meetsMin = subtotal >= (c.min_bill_amount || 0)
          const discountLabel = c.discount_type === 'percent'
            ? `${c.discount_value}% off${c.max_discount ? ` (max ₹${c.max_discount})` : ''}`
            : `₹${Number(c.discount_value).toFixed(0)} off`

          return (
            <div
              key={c.id}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors
                ${isApplied
                  ? 'border-green-400 bg-green-50'
                  : meetsMin
                    ? 'border-brand-200 bg-brand-50/40 hover:border-brand-400'
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-gray-900">{c.code}</span>
                  {c.outlet_name && (
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full leading-none">
                      {c.outlet_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.name ? `${c.name} · ` : ''}{discountLabel}
                  {c.min_bill_amount > 0 && !meetsMin && (
                    <span className="text-orange-500"> · Min ₹{c.min_bill_amount}</span>
                  )}
                </p>
              </div>
              <button
                disabled={isApplied || !meetsMin}
                onClick={() => onApply(c.code)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md whitespace-nowrap transition-colors
                  ${isApplied
                    ? 'bg-green-100 text-green-700 cursor-default'
                    : meetsMin
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
              >
                {isApplied ? 'Applied' : 'Apply'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PaymentModal({ cart, subtotal, onClose, onConfirm, loading, users, outletId, tenant }) {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [staffId, setStaffId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponLoading, setCouponLoading] = useState(false)

  const { data: availableCoupons = [] } = useQuery({
    queryKey: ['salon-coupons-billing', tenant?.id, outletId],
    queryFn: () => salonAPI.listCoupons({
      active_only: true,
      ...(outletId ? { outlet_id: outletId } : {}),
    }).then(r => r.data),
    enabled: !!tenant?.id,
  })

  const discount = appliedCoupon?.discount_amount || 0
  const total = Math.max(0, subtotal - discount)

  const doValidate = async (code) => {
    if (!code.trim()) return
    setCouponLoading(true)
    try {
      const res = await salonAPI.validateCoupon({
        code: code.trim().toUpperCase(),
        invoice_total: subtotal,
        outlet_id: outletId || null,
        service_ids: cart.filter(i => i.type === 'service').map(i => i.id),
        package_ids: cart.filter(i => i.type === 'package').map(i => i.id),
      })
      if (res.data.valid) {
        setAppliedCoupon(res.data)
        setCouponCode(code.trim().toUpperCase())
        toast.success(`Coupon applied: -${formatCurrency(res.data.discount_amount)}`)
      } else {
        setAppliedCoupon(null)
        toast.error(res.data.error || 'Invalid coupon')
      }
    } catch {
      toast.error('Could not validate coupon')
    } finally {
      setCouponLoading(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
  }

  const handleSubmit = () => {
    onConfirm({
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      staff_id: staffId ? Number(staffId) : null,
      payment_method: paymentMethod,
      coupon_code: appliedCoupon ? couponCode : null,
      coupon_id: appliedCoupon?.coupon_id || null,
      coupon_discount: discount,
      discount_amount: 0,
      outlet_id: outletId || null,
      subtotal,
      total,
      items: cart.map(item => ({
        item_type: item.type,
        service_id: item.type === 'service' ? item.id : null,
        package_id: item.type === 'package' ? item.id : null,
        item_name: item.name,
        price: item.price,
        quantity: item.qty,
      })),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Complete Bill</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Customer Name <span className="text-gray-400 text-xs">(optional)</span></label>
              <input className="input" placeholder="Walk-in" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div>
              <label className="label">Phone <span className="text-gray-400 text-xs">(optional)</span></label>
              <input className="input" placeholder="—" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Staff / Stylist <span className="text-gray-400 text-xs">(optional)</span></label>
            <select className="input" value={staffId} onChange={e => setStaffId(e.target.value)}>
              <option value="">Select staff...</option>
              {(users || []).filter(u => u.is_active).map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          {/* Available coupon suggestions */}
          <AvailableCoupons
            coupons={availableCoupons}
            subtotal={subtotal}
            appliedCode={appliedCoupon ? couponCode : null}
            onApply={(code) => doValidate(code)}
          />

          {/* Manual coupon entry */}
          <div>
            <label className="label">Coupon Code</label>
            {appliedCoupon ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-300 rounded-lg px-3 py-2">
                <Tag size={14} className="text-green-600 flex-shrink-0" />
                <span className="font-mono text-sm font-semibold text-green-800 flex-1">{couponCode}</span>
                <span className="text-sm text-green-700 font-medium">-{formatCurrency(discount)}</span>
                <button onClick={handleRemoveCoupon} className="text-green-500 hover:text-red-500 ml-1">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className="input flex-1 uppercase"
                  placeholder="Enter code..."
                  value={couponCode}
                  onChange={e => { setCouponCode(e.target.value); setAppliedCoupon(null) }}
                  onKeyDown={e => e.key === 'Enter' && doValidate(couponCode)}
                />
                <button
                  onClick={() => doValidate(couponCode)}
                  disabled={couponLoading || !couponCode.trim()}
                  className="btn-secondary text-sm px-3 py-2 whitespace-nowrap"
                >
                  {couponLoading ? '...' : 'Apply'}
                </button>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div>
            <label className="label">Payment Method</label>
            <div className="flex gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    paymentMethod === m.value
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'border-gray-300 text-gray-700 hover:border-brand-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bill summary */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Coupon Discount ({couponCode})</span><span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-gray-900 border-t border-gray-200 pt-1.5">
              <span>Total</span><span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || cart.length === 0}
            className="btn-primary flex-1"
          >
            {loading ? 'Creating...' : `Bill It · ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SalonBilling() {
  const { tenant } = useAuthStore()
  const { outlets, defaultOutletId } = useUserOutlets()
  const qc = useQueryClient()
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [activeTab, setActiveTab] = useState('services') // 'services' | 'packages'
  const [cart, setCart] = useState([])
  const [showPayment, setShowPayment] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedOutlet, setSelectedOutlet] = useState(null)

  const outletId = selectedOutlet ?? defaultOutletId

  const { data: categories = [] } = useQuery({
    queryKey: ['salon-categories', tenant?.id],
    queryFn: () => salonAPI.listCategories().then(r => r.data),
    enabled: !!tenant?.id,
  })

  const { data: services = [] } = useQuery({
    queryKey: ['salon-services', tenant?.id, outletId],
    queryFn: () => salonAPI.listServices(outletId ? { outlet_id: outletId } : {}).then(r => r.data),
    enabled: !!tenant?.id,
  })

  const { data: packages = [] } = useQuery({
    queryKey: ['salon-packages', tenant?.id, outletId],
    queryFn: () => salonAPI.listPackages(outletId ? { outlet_id: outletId } : undefined).then(r => r.data),
    enabled: !!tenant?.id,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.list().then(r => r.data || []),
    enabled: showPayment && !!tenant?.id,
  })

  const createBillMutation = useMutation({
    mutationFn: (data) => salonAPI.createBill(data),
    onSuccess: (res) => {
      toast.success(`Bill #${res.data.bill_number} created!`)
      setCart([])
      setShowPayment(false)
      qc.invalidateQueries({ queryKey: ['salon-bills'] })
      qc.invalidateQueries({ queryKey: ['salon-summary'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create bill'),
  })

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase()
    if (activeTab === 'services') {
      return services.filter(s =>
        (!selectedCategory || s.category_id === selectedCategory) &&
        (!q || s.name.toLowerCase().includes(q))
      )
    }
    return packages.filter(p => !q || p.name.toLowerCase().includes(q))
  }, [activeTab, services, packages, search, selectedCategory])

  const addToCart = (item, type) => {
    setCart(prev => {
      const key = `${type}-${item.id}`
      const existing = prev.find(c => c.cartKey === key)
      if (existing) {
        return prev.map(c => c.cartKey === key ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { ...item, type, cartKey: key, qty: 1 }]
    })
  }

  const removeFromCart = (cartKey) => setCart(prev => prev.filter(c => c.cartKey !== cartKey))

  const changeQty = (cartKey, delta) => {
    setCart(prev => prev
      .map(c => c.cartKey === cartKey ? { ...c, qty: c.qty + delta } : c)
      .filter(c => c.qty > 0)
    )
  }

  const subtotal = cart.reduce((sum, c) => sum + Number(c.price) * c.qty, 0)

  return (
    <div className="flex h-full overflow-hidden flex-col">
      {/* Outlet selector — only shown when tenant has multiple outlets */}
      {outlets.length > 1 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200">
          <Store size={14} className="text-amber-600 flex-shrink-0" />
          <span className="text-xs text-amber-700 font-medium">Outlet:</span>
          <select
            className="text-xs border border-amber-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
            value={selectedOutlet ?? defaultOutletId ?? ''}
            onChange={e => { setSelectedOutlet(Number(e.target.value) || null); setCart([]) }}
          >
            {outlets.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <span className="text-xs text-amber-600">Prices shown for this outlet</span>
        </div>
      )}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
      {/* Left — service picker */}
      <div className="flex-1 flex flex-col overflow-hidden border-b md:border-b-0 md:border-r border-gray-200">
        {/* Tabs + search */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('services')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'services' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Services
            </button>
            <button
              onClick={() => setActiveTab('packages')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'packages' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Packages
            </button>
          </div>
          <input
            className="input text-sm"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {activeTab === 'services' && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${!selectedCategory ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Scissors size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No {activeTab} found</p>
              <p className="text-xs mt-1">Add {activeTab} in the Services page first</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredItems.map(item => (
                <ServiceCard
                  key={item.id}
                  item={item}
                  onAdd={(i) => addToCart(i, activeTab === 'services' ? 'service' : 'package')}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right — cart */}
      <div className="w-full md:w-80 flex flex-col bg-white max-h-72 md:max-h-none">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Bill Items</h2>
          <p className="text-xs text-gray-400 mt-0.5">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-300">
              <p className="text-sm">Add services to the bill</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {cart.map(item => (
                <div key={item.cartKey} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(item.price)} × {item.qty}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeQty(item.cartKey, -1)} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                      <Minus size={12} />
                    </button>
                    <span className="text-sm w-5 text-center">{item.qty}</span>
                    <button onClick={() => changeQty(item.cartKey, 1)} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                      <Plus size={12} />
                    </button>
                    <button onClick={() => removeFromCart(item.cartKey)} className="w-8 h-8 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center ml-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="flex justify-between text-base font-semibold text-gray-900">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <button
            onClick={() => setShowPayment(true)}
            disabled={cart.length === 0}
            className="w-full btn-primary py-3"
          >
            Bill It
          </button>
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          cart={cart}
          subtotal={subtotal}
          users={users}
          outletId={outletId}
          tenant={tenant}
          loading={createBillMutation.isPending}
          onClose={() => setShowPayment(false)}
          onConfirm={(data) => createBillMutation.mutate(data)}
        />
      )}
      </div>
    </div>
  )
}
