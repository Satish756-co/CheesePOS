import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { productsAPI, billingAPI, inventoryAPI } from '@/api'
import { useBillingStore } from '@/store/billingStore'
import { useUserOutlets } from '@/hooks/useUserOutlets'
import { formatCurrency } from '@/utils/formatters'
import BillReceipt from '@/components/BillReceipt'
import toast from 'react-hot-toast'
import {
  Search, Plus, Minus, Receipt, X,
} from 'lucide-react'

const PAYMENT_MODES = ['cash', 'upi', 'card', 'split']

function ProductCard({ product, onAdd, isOOS }) {
  return (
    <button
      onClick={() => onAdd(product)}
      className="bg-white border border-gray-200 rounded-xl p-3 text-left hover:border-brand-400 hover:shadow-sm transition-all group"
    >
      <div className="aspect-square bg-gray-50 rounded-lg mb-2 flex items-center justify-center overflow-hidden relative">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl">{product.is_liquor ? '🍺' : '🍽️'}</span>
        )}
        {isOOS && (
          <span className="absolute inset-0 flex items-center justify-center bg-gray-800/70 rounded-lg text-white text-xs font-bold tracking-wide">
            OUT OF STOCK
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-900 truncate">{product.name}</p>
      {product.brand && <p className="text-xs text-gray-400 truncate">{product.brand}</p>}
      <p className="text-sm font-bold text-brand-600 mt-1">{formatCurrency(product.selling_price)}</p>
    </button>
  )
}

export default function Billing() {
  const { cart, addItem, updateQty, removeItem, clearCart, getTotals, generateIdempotencyKey } = useBillingStore()
  const { outlets, defaultOutletId, isError: outletsError } = useUserOutlets()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedOutletId, setSelectedOutletId] = useState(null)
  const [paymentModal, setPaymentModal] = useState(false)
  const [paymentMode, setPaymentMode] = useState('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [splitAmounts, setSplitAmounts] = useState({ cash: '', upi: '', card: '' })
  const [saving, setSaving] = useState(false)
  const [lastInvoice, setLastInvoice] = useState(null)

  // Auto-select user's default outlet when outlets load
  useEffect(() => {
    if (defaultOutletId && !selectedOutletId) setSelectedOutletId(defaultOutletId)
  }, [defaultOutletId])

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productsAPI.listCategories().then(r => r.data),
  })

  const { data: productData } = useQuery({
    queryKey: ['products', search, selectedCategory],
    queryFn: () => productsAPI.list({
      search, category_id: selectedCategory, include_variants: true, per_page: 60
    }).then(r => r.data),
  })

  const products = productData?.products || []
  const totals = getTotals()

  const { data: stockData } = useQuery({
    queryKey: ['stock-quick', selectedOutletId],
    queryFn: () => inventoryAPI.getCurrentStock({ outlet_id: selectedOutletId, per_page: 500 }).then(r => r.data.stock),
    enabled: !!selectedOutletId,
    staleTime: 60000,
  })
  const stockMap = {}
  ;(stockData || []).forEach(s => {
    const key = s.variant_id ? `v${s.variant_id}` : `p${s.product_id}`
    stockMap[key] = s.current_stock
  })
  const isOOS = (productId, variantId) => {
    const s = stockMap[variantId ? `v${variantId}` : `p${productId}`]
    return s !== undefined && s <= 0
  }

  const handleAddProduct = (product, variant = null) => {
    if (!selectedOutletId) {
      toast.error('Please select an outlet first')
      return
    }
    const stockKey = variant ? `v${variant.id}` : `p${product.id}`
    const available = stockMap[stockKey]
    if (available !== undefined) {
      const inCart = cart.reduce((sum, i) => {
        const k = i.variant_id ? `v${i.variant_id}` : `p${i.product_id}`
        return k === stockKey ? sum + i.quantity : sum
      }, 0)
      if (inCart >= available) {
        toast.error(`Only ${Math.floor(available)} in stock`)
        return
      }
    }
    addItem(product, variant)
  }

  const handleBillGenerate = async () => {
    if (cart.length === 0) return toast.error('Cart is empty')
    if (!selectedOutletId) return toast.error('Select outlet')

    setSaving(true)
    const ikey = generateIdempotencyKey()
    try {
      const payments = paymentMode === 'split'
        ? (() => {
            const splitTotal = Object.values(splitAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
            if (Math.abs(splitTotal - totals.total) > 0.01) {
              toast.error('Split amounts must equal the total')
              setSaving(false)
              return null
            }
            return [
              { payment_mode: 'cash', amount: parseFloat(splitAmounts.cash) || 0 },
              { payment_mode: 'upi', amount: parseFloat(splitAmounts.upi) || 0 },
              { payment_mode: 'card', amount: parseFloat(splitAmounts.card) || 0 },
            ].filter(p => p.amount > 0)
          })()
        : paymentMode === 'cash'
          ? [{ payment_mode: 'cash', amount: parseFloat(cashGiven) || totals.total }]
          : [{ payment_mode: paymentMode, amount: totals.total }]

      if (!payments) return

      const res = await billingAPI.createInvoice({
        outlet_id: selectedOutletId,
        billing_type: 'counter',
        items: cart.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          discount_percent: item.discount_percent || 0,
        })),
        payments,
        idempotency_key: ikey,
      })
      setLastInvoice(res.data)
      clearCart()
      setPaymentModal(false)
      qc.invalidateQueries({ queryKey: ['stock-quick'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate bill')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        {/* Outlet error */}
        {outletsError && (
          <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Could not load outlets — billing is disabled until the connection is restored.
          </div>
        )}
        {/* Outlet + Search */}
        <div className="flex gap-3 mb-3">
          {outlets && outlets.length > 1 && (
            <select
              className="input w-40"
              value={selectedOutletId || ''}
              onChange={e => setSelectedOutletId(parseInt(e.target.value))}
            >
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0
              ${!selectedCategory ? 'bg-brand-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400'}`}
          >
            All
          </button>
          {(categories || []).map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0
                ${selectedCategory === cat.id ? 'bg-brand-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map(product => (
              product.variants && product.variants.length > 0 ? (
                product.variants.map(variant => (
                  <button
                    key={`${product.id}-${variant.id}`}
                    onClick={() => handleAddProduct(product, variant)}
                    className="bg-white border border-gray-200 rounded-xl p-3 text-left hover:border-brand-400 hover:shadow-sm transition-all"
                  >
                    <div className="aspect-square bg-gray-50 rounded-lg mb-2 flex items-center justify-center relative">
                      <span className="text-2xl">{product.is_liquor ? '🍺' : '🍽️'}</span>
                      {isOOS(product.id, variant.id) && (
                        <span className="absolute inset-0 flex items-center justify-center bg-gray-800/70 rounded-lg text-white text-xs font-bold tracking-wide">
                          OUT OF STOCK
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-400 truncate">{variant.variant_name}</p>
                    <p className="text-sm font-bold text-brand-600 mt-1">{formatCurrency(variant.selling_price)}</p>
                  </button>
                ))
              ) : (
                <ProductCard key={product.id} product={product} onAdd={p => handleAddProduct(p)} isOOS={isOOS(product.id, null)} />
              )
            ))}
          </div>
          {products.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">📦</p>
              <p>No products found</p>
              <p className="text-xs mt-1">Add products in the Products section</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 flex flex-col bg-white border-l border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Receipt size={18} className="text-brand-500" />
            Bill ({cart.length})
          </h2>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-gray-400 hover:text-red-500 transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.map(item => (
            <div key={item.key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                {item.variant_name && (
                  <p className="text-xs text-gray-400">{item.variant_name}</p>
                )}
                <p className="text-sm font-bold text-brand-600">{formatCurrency(item.price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQty(item.key, item.quantity - 1)}
                  className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                >
                  <Minus size={10} />
                </button>
                <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                <button
                  onClick={() => {
                    const key = item.variant_id ? `v${item.variant_id}` : `p${item.product_id}`
                    const available = stockMap[key]
                    if (available !== undefined && item.quantity >= available) {
                      toast.error(`Only ${Math.floor(available)} in stock`)
                      return
                    }
                    updateQty(item.key, item.quantity + 1)
                  }}
                  className="w-6 h-6 rounded-full bg-brand-100 hover:bg-brand-200 text-brand-700 flex items-center justify-center"
                >
                  <Plus size={10} />
                </button>
              </div>
              <p className="text-sm font-bold w-16 text-right">
                {formatCurrency(item.price * item.quantity)}
              </p>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Receipt size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Add products to bill</p>
            </div>
          )}
        </div>

        {/* Totals */}
        {cart.length > 0 && (
          <div className="border-t border-gray-200 p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.discountAmt > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(totals.discountAmt)}</span>
              </div>
            )}
            {totals.tax > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax (GST)</span>
                <span>{formatCurrency(totals.tax)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span>
              <span className="text-brand-600">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        )}

        {/* Generate bill button */}
        <div className="p-4">
          <button
            onClick={() => setPaymentModal(true)}
            disabled={cart.length === 0}
            className="btn-primary w-full py-3 text-base"
          >
            Generate Bill
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-96 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Collect Payment</h3>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex justify-between font-bold text-lg">
                <span>Total Amount</span>
                <span className="text-brand-600">{formatCurrency(totals.total)}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="label">Payment Mode</label>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_MODES.map(mode => (
                  <button
                    key={mode}
                    onClick={() => { setPaymentMode(mode); setSplitAmounts({ cash: '', upi: '', card: '' }); setCashGiven('') }}
                    className={`py-2 rounded-lg text-sm font-medium capitalize transition-colors
                      ${paymentMode === mode ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {paymentMode === 'cash' && (
              <div className="mb-4">
                <label className="label">Cash Given</label>
                <input
                  type="number"
                  className="input text-lg"
                  placeholder={totals.total.toString()}
                  value={cashGiven}
                  onChange={e => setCashGiven(e.target.value)}
                />
                {cashGiven && parseFloat(cashGiven) >= totals.total && (
                  <p className="text-sm text-green-600 mt-1">
                    Change: {formatCurrency(parseFloat(cashGiven) - totals.total)}
                  </p>
                )}
              </div>
            )}

            {paymentMode === 'split' && (
              <div className="mb-4">
                <label className="label">Split Payment</label>
                <div className="space-y-2">
                  {[{ key: 'cash', label: 'Cash' }, { key: 'upi', label: 'UPI' }, { key: 'card', label: 'Card' }].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-10 flex-shrink-0">{label}</span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                        <input
                          type="number"
                          className="input pl-7"
                          placeholder="0"
                          value={splitAmounts[key]}
                          onChange={e => setSplitAmounts(s => ({ ...s, [key]: e.target.value }))}
                        />
                      </div>
                    </div>
                  ))}
                  {(() => {
                    const allocated = Object.values(splitAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
                    const remaining = Math.round((totals.total - allocated) * 100) / 100
                    return remaining !== 0 ? (
                      <p className={`text-sm font-medium text-right ${remaining > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                        {remaining > 0 ? `Remaining: ${formatCurrency(remaining)}` : `Over by: ${formatCurrency(-remaining)}`}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-right text-green-600">✓ Fully allocated</p>
                    )
                  })()}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setPaymentModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleBillGenerate}
                disabled={saving}
                className="btn-primary flex-1"
              >
                {saving ? 'Processing...' : 'Confirm & Print'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Receipt Modal */}
      {lastInvoice && (
        <BillReceipt invoice={lastInvoice} onClose={() => setLastInvoice(null)} />
      )}
    </div>
  )
}
