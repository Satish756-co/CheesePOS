import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { productsAPI, billingAPI, outletsAPI, ordersAPI, inventoryAPI } from '@/api'
import { useUserOutlets } from '@/hooks/useUserOutlets'
import { formatCurrency } from '@/utils/formatters'
import { TABLE_STATUS_COLORS } from '@/utils/formatters'
import BillReceipt from '@/components/BillReceipt'
import toast from 'react-hot-toast'
import {
  Search, Plus, Minus, Trash2, Receipt, X, Users,
  ShoppingBag, ClipboardList, CheckCircle, ChevronLeft,
} from 'lucide-react'

const PAYMENT_MODES = ['cash', 'upi', 'card', 'split']

// ── Table Grid ──────────────────────────────────────────────────────────
function TableGrid({ outlet, onSelectTable, selectedTableId }) {
  const { data: tables = [], isError } = useQuery({
    queryKey: ['tables', outlet?.id],
    queryFn: () => outletsAPI.getTables(outlet.id).then(r => r.data),
    enabled: !!outlet?.id,
    refetchInterval: 10000,
  })

  const sections = [...new Set(tables.map(t => t.floor_section))]

  if (isError) {
    return (
      <div className="text-center py-12 text-red-400">
        <p className="text-2xl mb-2">⚠️</p>
        <p className="font-medium text-sm">Could not load tables</p>
        <p className="text-xs mt-1">Check the backend connection</p>
      </div>
    )
  }

  if (tables.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-3xl mb-2">🪑</p>
        <p className="font-medium text-sm">No tables configured</p>
        <p className="text-xs mt-1">Go to Outlets → Tables to add tables</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sections.map(section => (
        <div key={section}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{section}</p>
          <div className="grid grid-cols-3 gap-2">
            {tables.filter(t => t.floor_section === section).map(table => (
              <button
                key={table.id}
                onClick={() => onSelectTable(table)}
                className={`border-2 rounded-xl p-2.5 text-left transition-all
                  ${selectedTableId === table.id ? 'ring-2 ring-brand-400 ring-offset-1' : ''}
                  ${TABLE_STATUS_COLORS[table.status] || 'bg-gray-100 border-gray-300'}`}
              >
                <p className="font-bold text-base text-center">{table.table_number}</p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <Users size={10} />
                  <span className="text-xs">{table.seating_capacity}</span>
                </div>
                <p className="text-xs text-center mt-0.5 capitalize">{table.status.replace('_', ' ')}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────
export default function TableBilling() {
  const qc = useQueryClient()
  const { outlets, defaultOutletId } = useUserOutlets()

  const [selectedOutletId, setSelectedOutletId] = useState(null)
  const [selectedTable, setSelectedTable] = useState(null)
  const [activeOrder, setActiveOrder] = useState(null)   // existing open order for the table
  const [cartItems, setCartItems] = useState([])         // new items not yet placed
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [paymentMode, setPaymentMode] = useState('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [splitAmounts, setSplitAmounts] = useState({ cash: '', upi: '', card: '' })
  const [saving, setSaving] = useState(false)
  const [lastInvoice, setLastInvoice] = useState(null)
  const [showBillPanel, setShowBillPanel] = useState(false)
  const [mobileStep, setMobileStep] = useState('table') // 'table' | 'products' | 'cart'

  useEffect(() => {
    if (defaultOutletId && !selectedOutletId) setSelectedOutletId(defaultOutletId)
  }, [defaultOutletId])

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productsAPI.listCategories().then(r => r.data),
  })

  const { data: productData } = useQuery({
    queryKey: ['products', search, selectedCategory],
    queryFn: () => productsAPI.list({ search, category_id: selectedCategory, include_variants: true, per_page: 60, for_billing: true }).then(r => r.data),
  })

  const products = productData?.products || []

  const { data: stockData, isLoading: stockLoading } = useQuery({
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
  const stockReady = !!selectedOutletId && !stockLoading && !!stockData
  const isOOS = (productId, variantId) => {
    const product = products.find(p => p.id === productId)
    if (product?.force_out_of_stock) return true
    if (!stockReady) return false
    const s = stockMap[variantId ? `v${variantId}` : `p${productId}`]
    return s === undefined || s <= 0
  }

  // When a table is selected, look for an existing open order
  const handleSelectTable = async (table) => {
    if (selectedTable?.id === table.id) {
      setSelectedTable(null)
      setActiveOrder(null)
      setCartItems([])
      setShowBillPanel(false)
      setMobileStep('table')
      return
    }

    setSelectedTable(table)
    setCartItems([])
    setShowBillPanel(false)
    setActiveOrder(null)
    setMobileStep('products')

    // Check for existing active order on this table
    try {
      const res = await ordersAPI.list({
        outlet_id: selectedOutletId,
        table_id: table.id,
        active_only: '1',
      })
      const openOrders = res.data
      if (openOrders && openOrders.length > 0) {
        setActiveOrder(openOrders[0])
        toast(`Table ${table.table_number} has an active order`, { icon: '📋' })
      }
    } catch {
      // no open order is fine
    }
  }

  // Add a product to the pending cart
  const handleAddProduct = (product, variant = null) => {
    if (!selectedTable) { toast.error('Select a table first'); return }
    if (product.force_out_of_stock) { toast.error('This item is marked as out of stock'); return }
    const stockKey = variant ? `v${variant.id}` : `p${product.id}`
    if (stockReady) {
      const available = stockMap[stockKey] ?? 0
      const cartKey = `${product.id}_${variant?.id || 'base'}`
      const inCart = cartItems.reduce((s, i) => i.key === cartKey ? s + i.quantity : s, 0)
      const inOrder = (activeOrder?.items || []).reduce((s, i) => {
        const match = variant ? i.variant_id === variant.id : (!i.variant_id && i.product_id === product.id)
        return match ? s + Number(i.quantity) : s
      }, 0)
      if (inCart + inOrder >= available) {
        toast.error(available > 0 ? `Only ${Math.floor(available)} in stock` : 'No stock available. Add stock in Inventory first.')
        return
      }
    }
    const key = `${product.id}_${variant?.id || 'base'}`
    const price = variant ? variant.selling_price : product.selling_price
    setCartItems(prev => {
      const existing = prev.find(i => i.key === key)
      if (existing) return prev.map(i => i.key === key ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, {
        key,
        product_id: product.id,
        variant_id: variant?.id || null,
        product_name: product.name + (variant ? ` — ${variant.variant_name}` : ''),
        price,
        quantity: 1,
      }]
    })
  }

  const updateCartQty = (key, qty) => {
    if (qty <= 0) setCartItems(prev => prev.filter(i => i.key !== key))
    else setCartItems(prev => prev.map(i => i.key === key ? { ...i, quantity: qty } : i))
  }

  const handleUpdateOrderItem = async (item, newQty) => {
    if (!activeOrder) return
    try {
      if (newQty <= 0) {
        const res = await ordersAPI.removeItem(activeOrder.id, item.id)
        setActiveOrder(res.data)
      } else {
        const res = await ordersAPI.updateItem(activeOrder.id, item.id, { quantity: newQty })
        setActiveOrder(res.data)
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update item')
    }
  }

  const handleRemoveOrderItem = async (item) => {
    if (!activeOrder) return
    try {
      const res = await ordersAPI.removeItem(activeOrder.id, item.id)
      setActiveOrder(res.data)
      toast.success(`${item.product_name} removed from order`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not remove item')
    }
  }

  const cartSubtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)

  // Place Order — creates a new order OR adds to existing
  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) { toast.error('Add items first'); return }
    if (!selectedOutletId) { toast.error('Select an outlet'); return }

    setSaving(true)
    try {
      const items = cartItems.map(i => ({
        product_id: i.product_id,
        variant_id: i.variant_id,
        quantity: i.quantity,
      }))

      let order
      if (activeOrder) {
        const res = await ordersAPI.addItems(activeOrder.id, { items })
        order = res.data
        toast.success(`Added ${cartItems.length} item(s) to order ${activeOrder.order_number}`)
      } else {
        const res = await ordersAPI.create({
          outlet_id: selectedOutletId,
          table_id: selectedTable.id,
          order_type: 'dine_in',
          items,
        })
        order = res.data
        toast.success(`Order ${order.order_number} placed for Table ${selectedTable.table_number}`)
      }

      setActiveOrder(order)
      setCartItems([])
      // Optimistically show table as occupied when a new order is created
      if (!activeOrder) {
        setSelectedTable(prev => prev ? { ...prev, status: 'occupied' } : prev)
      }
      qc.invalidateQueries({ queryKey: ['tables', selectedOutletId] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['stock-quick'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to place order')
    } finally {
      setSaving(false)
    }
  }

  const TAX_RATES = { gst_0: 0, gst_5: 5, gst_12: 12, gst_18: 18, gst_28: 28, liquor_ap: 0, exempt: 0 }

  // All items combined: committed order items + pending cart items
  const allOrderItems = [
    ...(activeOrder?.items || []).map(i => ({
      key: `order_${i.id}`,
      product_name: i.product_name,
      price: i.unit_price,
      quantity: Number(i.quantity),
      tax_category: i.tax_category || null,
      committed: true,
    })),
    ...cartItems.map(i => ({ ...i, committed: false })),
  ]

  const billSubtotal = allOrderItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0)
  const billTax = allOrderItems.reduce((s, i) => {
    const rate = TAX_RATES[i.tax_category] || 0
    return s + Number(i.price) * i.quantity * rate / 100
  }, 0)
  const billTotal = Math.round(billSubtotal + billTax)

  // Generate Bill — places any pending cart items first, then creates invoice
  const handleBill = async () => {
    if (!selectedTable) return toast.error('Select a table first')
    if (!activeOrder && cartItems.length === 0) return toast.error('No items to bill')
    if (!selectedOutletId) return toast.error('Select an outlet')
    if (billSubtotal <= 0) return toast.error('Nothing to bill')

    setSaving(true)
    const ikey = `${selectedTable.id}-${Date.now()}`
    try {
      let orderToBill = activeOrder

      // If there are uncommitted cart items, add them to the order first
      if (cartItems.length > 0) {
        const items = cartItems.map(i => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          quantity: i.quantity,
        }))

        if (orderToBill) {
          const res = await ordersAPI.addItems(orderToBill.id, { items })
          orderToBill = res.data
        } else {
          const res = await ordersAPI.create({
            outlet_id: selectedOutletId,
            table_id: selectedTable.id,
            order_type: 'dine_in',
            items,
          })
          orderToBill = res.data
        }
      }

      // Build item list from the final order
      const invoiceItems = (orderToBill.items || []).map(i => ({
        product_id: i.product_id,
        variant_id: i.variant_id,
        quantity: Number(i.quantity),
        discount_percent: 0,
      }))

      const payments = paymentMode === 'split'
        ? (() => {
            const splitTotal = Object.values(splitAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
            if (Math.abs(splitTotal - billTotal) > 0.01) {
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
          ? [{ payment_mode: 'cash', amount: parseFloat(cashGiven) || billTotal }]
          : [{ payment_mode: paymentMode, amount: billTotal }]

      if (!payments) return

      const res = await billingAPI.createInvoice({
        outlet_id: selectedOutletId,
        billing_type: 'table',
        order_id: orderToBill.id,
        customer_name: `Table ${selectedTable.table_number}`,
        table_id: selectedTable.id,
        items: invoiceItems,
        payments,
        idempotency_key: ikey,
      })

      setLastInvoice(res.data)
      setActiveOrder(null)
      setCartItems([])
      setSelectedTable(null)
      setShowBillPanel(false)
      setMobileStep('table')
      qc.invalidateQueries({ queryKey: ['tables', selectedOutletId] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['stock-quick'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      toast.success(`Bill generated: ${res.data.invoice_number}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Billing failed')
    } finally {
      setSaving(false)
    }
  }

  const selectedOutlet = outlets.find(o => o.id === selectedOutletId)

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Mobile step header (hidden on lg+) ── */}
      <div className="lg:hidden flex-shrink-0 bg-white border-b border-gray-200 px-4 pt-3 pb-2">
        <div className="flex items-center gap-3">
          {mobileStep !== 'table' && (
            <button
              onClick={() => setMobileStep(mobileStep === 'cart' ? 'products' : 'table')}
              className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            {mobileStep === 'table' && <p className="font-bold text-gray-900">Select a Table</p>}
            {mobileStep === 'products' && (
              <>
                <p className="font-bold text-gray-900 truncate">
                  Table {selectedTable?.table_number}
                  {activeOrder && <span className="text-xs font-normal text-orange-600 ml-2">{activeOrder.order_number}</span>}
                </p>
                <p className="text-xs text-gray-400">{allOrderItems.length} item{allOrderItems.length !== 1 ? 's' : ''} added</p>
              </>
            )}
            {mobileStep === 'cart' && (
              <p className="font-bold text-gray-900">Table {selectedTable?.table_number} — Bill</p>
            )}
          </div>
          {mobileStep === 'products' && (
            <button
              onClick={() => setMobileStep('cart')}
              disabled={allOrderItems.length === 0}
              className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Receipt size={14} /> View Bill ({allOrderItems.length})
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          {['table', 'products', 'cart'].map(step => (
            <div
              key={step}
              className={`h-1 rounded-full transition-all duration-300 ${mobileStep === step ? 'w-6 bg-brand-500' : 'w-2 bg-gray-200'}`}
            />
          ))}
          <span className="text-[11px] text-gray-400 ml-1">
            {mobileStep === 'table' ? '1 / 3 · Choose table' : mobileStep === 'products' ? '2 / 3 · Add items' : '3 / 3 · Generate bill'}
          </span>
        </div>
      </div>

      {/* ── Three-panel layout ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

      {/* LEFT: Table selector */}
      <div className={`lg:w-64 lg:flex-shrink-0 bg-white lg:border-r border-gray-200 flex-col overflow-hidden ${mobileStep === 'table' ? 'flex flex-1' : 'hidden lg:flex'}`}>
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-800 text-sm mb-3">Tables</h2>
          {outlets.length > 1 && (
            <select
              className="input w-full text-sm"
              value={selectedOutletId || ''}
              onChange={e => { setSelectedOutletId(parseInt(e.target.value)); setSelectedTable(null); setActiveOrder(null); setCartItems([]) }}
            >
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {selectedOutlet ? (
            <TableGrid outlet={selectedOutlet} onSelectTable={handleSelectTable} selectedTableId={selectedTable?.id} />
          ) : (
            <p className="text-center text-gray-400 text-sm py-8">Select an outlet</p>
          )}
        </div>
        {/* Legend */}
        <div className="p-3 border-t border-gray-100 space-y-1">
          {[['available', 'Available'], ['occupied', 'Occupied'], ['billed', 'Billed'], ['reserved', 'Reserved']].map(([s, l]) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded border ${TABLE_STATUS_COLORS[s]?.split(' ').slice(0, 2).join(' ') || 'bg-gray-100 border-gray-300'}`} />
              <span className="text-xs text-gray-500">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* MIDDLE: Product picker */}
      <div className={`flex-col overflow-hidden bg-gray-50 flex-1 ${mobileStep === 'products' ? 'flex' : 'hidden lg:flex'}`}>
        {/* Context bar — desktop only */}
        <div className="hidden lg:flex bg-white border-b border-gray-200 p-3 items-center gap-3 min-h-[52px]">
          {selectedTable ? (
            <div className="flex items-center gap-3 w-full">
              <div className="bg-brand-100 text-brand-700 font-bold rounded-lg px-3 py-1 text-sm">
                Table {selectedTable.table_number}
              </div>
              {activeOrder ? (
                <span className="text-sm text-orange-600 font-medium flex items-center gap-1">
                  <ClipboardList size={14} />
                  Order {activeOrder.order_number} · {activeOrder.items?.length || 0} items
                </span>
              ) : (
                <span className="text-sm text-gray-400">New order</span>
              )}
              {(activeOrder || cartItems.length > 0) && (
                <button
                  onClick={() => setShowBillPanel(b => !b)}
                  className="ml-auto btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5"
                >
                  <Receipt size={14} />
                  {showBillPanel ? 'Hide Bill' : 'Generate Bill'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">← Select a table to start</p>
          )}
        </div>

        {/* Category tabs */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${!selectedCategory ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(selectedCategory === c.id ? null : c.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === c.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={selectedCategory === c.id ? { backgroundColor: c.color || '#6366f1' } : {}}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 text-sm" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {products.map(product =>
              product.variants && product.variants.length > 0 ? (
                <div key={product.id} className="bg-white border border-gray-200 rounded-xl p-3">
                  <div className="aspect-square bg-gray-50 rounded-lg mb-2 flex items-center justify-center relative overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{product.is_liquor ? '🍺' : '🍽️'}</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-900 truncate">{product.name}</p>
                  {product.brand && <p className="text-xs text-gray-400 truncate">{product.brand}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {product.variants.map(variant => {
                      const oos = isOOS(product.id, variant.id)
                      return (
                        <button
                          key={variant.id}
                          onClick={() => !oos && selectedTable && handleAddProduct(product, variant)}
                          disabled={!selectedTable}
                          className={`text-xs px-2 py-1 rounded-lg border transition-colors disabled:opacity-40 ${
                            oos
                              ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                              : 'border-brand-300 text-brand-700 bg-brand-50 hover:bg-brand-100'
                          }`}
                        >
                          {variant.variant_name} · {formatCurrency(variant.selling_price)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <button
                  key={product.id}
                  onClick={() => handleAddProduct(product)}
                  disabled={!selectedTable}
                  className="bg-white border border-gray-200 rounded-xl p-3 text-left hover:border-brand-400 hover:shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="aspect-square bg-gray-50 rounded-lg mb-2 flex items-center justify-center relative overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{product.is_liquor ? '🍺' : '🍽️'}</span>
                    )}
                    {isOOS(product.id, null) && (
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
            )}
          </div>
          {products.length === 0 && !search && (
            <div className="text-center py-8 text-gray-400 text-sm">No products found</div>
          )}
        </div>

        {/* Mobile: sticky place-order bar — shown when cart has pending items */}
        {cartItems.length > 0 && (
          <div className="lg:hidden flex-shrink-0 bg-white border-t border-gray-200 p-3">
            <button
              onClick={handlePlaceOrder}
              disabled={saving}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
            >
              <CheckCircle size={15} />
              {saving ? 'Placing...' : activeOrder
                ? `Add ${cartItems.length} item${cartItems.length > 1 ? 's' : ''} to Order`
                : `Place Order · ${formatCurrency(cartSubtotal)}`
              }
            </button>
          </div>
        )}
      </div>

      {/* RIGHT: Cart (new items) + active order */}
      <div className={`lg:w-80 lg:flex-shrink-0 bg-white lg:border-l border-gray-200 flex-col overflow-hidden ${mobileStep === 'cart' ? 'flex flex-1' : 'hidden lg:flex'}`}>

        {/* Active order items — editable */}
        {activeOrder && activeOrder.items && activeOrder.items.length > 0 && (
          <div className="border-b border-gray-200">
            <div className="px-4 py-2 bg-orange-50 flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                {activeOrder.order_number} — Placed Items
              </span>
              <span className="text-xs text-orange-600">{activeOrder.items.length} items</span>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
              {activeOrder.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(item.unit_price)} each</p>
                  </div>
                  {/* Qty controls */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleUpdateOrderItem(item, Number(item.quantity) - 1)}
                      className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      <Minus size={9} />
                    </button>
                    <span className="text-xs font-bold w-5 text-center">{Number(item.quantity)}</span>
                    <button
                      onClick={() => {
                        const stockKey = item.variant_id ? `v${item.variant_id}` : `p${item.product_id}`
                        const available = stockMap[stockKey]
                        if (available !== undefined) {
                          const inCart = cartItems.reduce((s, ci) => {
                            const match = item.variant_id ? ci.variant_id === item.variant_id : (!ci.variant_id && ci.product_id === item.product_id)
                            return match ? s + ci.quantity : s
                          }, 0)
                          if (Number(item.quantity) + inCart >= available) {
                            toast.error(`Only ${Math.floor(available)} in stock`)
                            return
                          }
                        } else if (stockReady) {
                          toast.error('No stock available. Add stock in Inventory first.')
                          return
                        }
                        handleUpdateOrderItem(item, Number(item.quantity) + 1)
                      }}
                      className="w-5 h-5 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-600 flex items-center justify-center"
                    >
                      <Plus size={9} />
                    </button>
                  </div>
                  <span className="text-xs font-medium text-gray-700 flex-shrink-0 w-14 text-right">
                    {formatCurrency(Number(item.unit_price) * Number(item.quantity))}
                  </span>
                  <button
                    onClick={() => handleRemoveOrderItem(item)}
                    className="text-gray-300 hover:text-red-500 flex-shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New cart items */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <ShoppingBag size={15} className="text-brand-500" />
              New Items ({cartItems.length})
            </span>
            {cartItems.length > 0 && (
              <button onClick={() => setCartItems([])} className="text-xs text-red-400 hover:text-red-600">Clear</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cartItems.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs">
                {selectedTable ? 'Tap products to add' : 'Select a table first'}
              </div>
            ) : (
              cartItems.map(item => (
                <div key={item.key} className="flex items-center gap-2 bg-brand-50 rounded-xl p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{item.product_name}</p>
                    <p className="text-xs text-brand-600 font-medium">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => updateCartQty(item.key, item.quantity - 1)} className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                      <Minus size={9} />
                    </button>
                    <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                    <button onClick={() => {
                      const stockKey = item.variant_id ? `v${item.variant_id}` : `p${item.product_id}`
                      const available = stockMap[stockKey]
                      if (available !== undefined) {
                        const inOrder = (activeOrder?.items || []).reduce((s, i) => {
                          const match = item.variant_id ? i.variant_id === item.variant_id : (!i.variant_id && i.product_id === item.product_id)
                          return match ? s + Number(i.quantity) : s
                        }, 0)
                        if (item.quantity + inOrder >= available) {
                          toast.error(`Only ${Math.floor(available)} in stock`)
                          return
                        }
                      } else if (stockReady) {
                        toast.error('No stock available. Add stock in Inventory first.')
                        return
                      }
                      updateCartQty(item.key, item.quantity + 1)
                    }} className="w-5 h-5 rounded-full bg-brand-100 hover:bg-brand-200 text-brand-600 flex items-center justify-center">
                      <Plus size={9} />
                    </button>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs font-medium">{formatCurrency(item.price * item.quantity)}</p>
                    <button onClick={() => updateCartQty(item.key, 0)} className="text-gray-300 hover:text-red-400">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Subtotal + Place Order */}
          {cartItems.length > 0 && (
            <div className="p-3 border-t border-gray-100">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Cart subtotal</span>
                <span className="font-medium">{formatCurrency(cartSubtotal)}</span>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={saving}
                className="w-full btn-primary py-2.5 flex items-center justify-center gap-2"
              >
                <CheckCircle size={15} />
                {saving ? 'Placing...' : activeOrder ? 'Add to Order' : 'Place Order'}
              </button>
            </div>
          )}
        </div>

        {/* Mobile: Generate Bill — shown on cart step */}
        {(activeOrder || cartItems.length > 0) && (
          <div className="lg:hidden flex-shrink-0 p-3 border-t border-gray-200 bg-white">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Total</span>
              <span className="font-bold text-gray-900">{formatCurrency(billTotal)}</span>
            </div>
            <button
              onClick={() => setShowBillPanel(true)}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
            >
              <Receipt size={15} />
              Generate Bill
            </button>
          </div>
        )}
      </div>

      </div>{/* end three-panel layout */}

      {/* BILL PANEL — slide-up overlay */}
      {showBillPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Bill — Table {selectedTable?.table_number}</h3>
                <p className="text-sm text-gray-500">{allOrderItems.length} items · {formatCurrency(billSubtotal)}</p>
              </div>
              <button onClick={() => setShowBillPanel(false)}><X size={20} /></button>
            </div>

            {/* All items (committed + pending) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {allOrderItems.map(item => (
                <div key={item.key} className={`flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0 ${!item.committed ? 'text-brand-700 bg-brand-50 -mx-1 px-1 rounded' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">{item.product_name}</span>
                    {!item.committed && <span className="text-xs text-brand-500 ml-1">(pending)</span>}
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-sm font-medium">{formatCurrency(Number(item.price) * item.quantity)}</p>
                    <p className="text-xs text-gray-400">×{item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 space-y-3">
              {billTax > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(billSubtotal)}</span>
                </div>
              )}
              {billTax > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Tax (GST)</span>
                  <span>{formatCurrency(billTax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-brand-600">{formatCurrency(billTotal)}</span>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1.5">Payment Mode</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {PAYMENT_MODES.map(mode => (
                    <button
                      key={mode}
                      onClick={() => { setPaymentMode(mode); setSplitAmounts({ cash: '', upi: '', card: '' }); setCashGiven('') }}
                      className={`py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${paymentMode === mode ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                {paymentMode === 'cash' && (
                  <>
                    <input
                      type="number"
                      className="input w-full mt-2 text-sm"
                      placeholder="Amount given ₹"
                      value={cashGiven}
                      onChange={e => setCashGiven(e.target.value)}
                    />
                    {cashGiven && parseFloat(cashGiven) >= billTotal && (
                      <p className="text-sm text-green-600 mt-1">Change: {formatCurrency(parseFloat(cashGiven) - billTotal)}</p>
                    )}
                  </>
                )}
                {paymentMode === 'split' && (
                  <div className="mt-2 space-y-1.5">
                    {[{ key: 'cash', label: 'Cash' }, { key: 'upi', label: 'UPI' }, { key: 'card', label: 'Card' }].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-8 flex-shrink-0">{label}</span>
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                          <input
                            type="number"
                            className="input pl-6 py-1.5 text-sm"
                            placeholder="0"
                            value={splitAmounts[key]}
                            onChange={e => setSplitAmounts(s => ({ ...s, [key]: e.target.value }))}
                          />
                        </div>
                      </div>
                    ))}
                    {(() => {
                      const allocated = Object.values(splitAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
                      const remaining = Math.round((billTotal - allocated) * 100) / 100
                      return remaining !== 0 ? (
                        <p className={`text-xs font-medium text-right ${remaining > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                          {remaining > 0 ? `Remaining: ${formatCurrency(remaining)}` : `Over by: ${formatCurrency(-remaining)}`}
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-right text-green-600">✓ Fully allocated</p>
                      )
                    })()}
                  </div>
                )}
              </div>

              <button
                onClick={handleBill}
                disabled={saving}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                <Receipt size={16} />
                {saving ? 'Processing...' : `Confirm & Bill Table ${selectedTable?.table_number}`}
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
