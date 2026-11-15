import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { purchasesAPI, productsAPI } from '@/api'
import { useUserOutlets } from '@/hooks/useUserOutlets'
import { formatCurrency, formatDate, todayIST } from '@/utils/formatters'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Plus, X, Truck, ShoppingBag, Trash2, Download, Package, CheckCircle, CreditCard, ChevronRight } from 'lucide-react'

// ── Supplier Modal ────────────────────────────────────────────────────
function SupplierModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', contact_person: '', phone: '', email: '',
    address: '', gstin: '', payment_terms: 30,
  })
  const [saving, setSaving] = useState(false)
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save supplier')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">Add Supplier</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="label">Supplier Name *</label>
            <input className="input" value={form.name} onChange={e => u('name', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact Person</label>
              <input className="input" value={form.contact_person} onChange={e => u('contact_person', e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => u('phone', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={e => u('email', e.target.value)} />
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="input resize-none h-16" value={form.address} onChange={e => u('address', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">GSTIN</label>
              <input className="input" value={form.gstin} onChange={e => u('gstin', e.target.value)} />
            </div>
            <div>
              <label className="label">Payment Terms (days)</label>
              <input type="number" className="input" value={form.payment_terms} onChange={e => u('payment_terms', parseInt(e.target.value))} min="0" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Add Supplier'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Purchase Modal ────────────────────────────────────────────────────
function PurchaseModal({ outlets, suppliers, products, onClose, onSave }) {
  const [form, setForm] = useState({
    outlet_id: outlets[0]?.id || '',
    supplier_id: suppliers[0]?.id || '',
    invoice_number: '',
    invoice_date: todayIST(),
    tax_amount: 0,
    paid_amount: 0,
    status: 'received',
    items: [],
  })
  const [saving, setSaving] = useState(false)
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addItem = () => u('items', [...form.items, { product_id: '', quantity: 1, unit_cost: '' }])
  const removeItem = (i) => u('items', form.items.filter((_, j) => j !== i))
  const updateItem = (i, key, val) => {
    const items = [...form.items]
    items[i] = { ...items[i], [key]: val }
    if (key === 'product_id') {
      const prod = products.find(p => p.id === parseInt(val))
      if (prod) items[i].unit_cost = prod.purchase_price || ''
    }
    u('items', items)
  }

  const subtotal = form.items.reduce((s, it) => s + (parseFloat(it.quantity || 0) * parseFloat(it.unit_cost || 0)), 0)
  const total = subtotal + parseFloat(form.tax_amount || 0)
  const balance = Math.max(total - parseFloat(form.paid_amount || 0), 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.items.length) { toast.error('Add at least one item'); return }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save purchase')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">New Purchase</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Outlet *</label>
              <select className="input" value={form.outlet_id} onChange={e => u('outlet_id', parseInt(e.target.value))} required>
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Supplier *</label>
              <select className="input" value={form.supplier_id} onChange={e => u('supplier_id', parseInt(e.target.value))} required>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Invoice No.</label>
              <input className="input" value={form.invoice_number} onChange={e => u('invoice_number', e.target.value)} placeholder="Supplier invoice number" />
            </div>
            <div>
              <label className="label">Invoice Date</label>
              <input type="date" className="input" value={form.invoice_date} onChange={e => u('invoice_date', e.target.value)} />
            </div>
          </div>

          {/* Arrival & Payment Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Stock Arrival</label>
              <select className="input" value={form.status} onChange={e => u('status', e.target.value)}>
                <option value="received">Received — Add to inventory now</option>
                <option value="pending">Pending — Not arrived yet</option>
              </select>
            </div>
            <div>
              <label className="label">Amount Paid (₹)</label>
              <input type="number" className="input" value={form.paid_amount} onChange={e => u('paid_amount', e.target.value)} min="0" step="0.01" placeholder="0 if unpaid" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0 font-semibold">Items *</label>
              <button type="button" onClick={addItem} className="btn-secondary text-sm py-1 px-3 flex items-center gap-1">
                <Plus size={13} /> Add Item
              </button>
            </div>
            {form.items.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-xl">
                Click "Add Item" to add products
              </p>
            )}
            {form.items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2 items-start">
                <select className="input flex-1" value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)} required>
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" className="input w-20" placeholder="Qty" value={item.quantity}
                  onChange={e => updateItem(i, 'quantity', e.target.value)} min="1" step="1" required />
                <input type="number" className="input w-28" placeholder="Cost ₹" value={item.unit_cost}
                  onChange={e => updateItem(i, 'unit_cost', e.target.value)} min="0" step="0.01" required />
                <span className="text-sm font-medium text-gray-600 w-20 text-right pt-2.5">
                  {formatCurrency((item.quantity || 0) * (item.unit_cost || 0))}
                </span>
                <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 pt-2.5">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tax Amount (₹)</label>
              <input type="number" className="input" value={form.tax_amount} onChange={e => u('tax_amount', e.target.value)} min="0" step="0.01" />
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Tax</span><span>{formatCurrency(parseFloat(form.tax_amount || 0))}</span></div>
              <div className="flex justify-between font-bold border-t border-gray-200 pt-1 mt-1"><span>Total</span><span>{formatCurrency(total)}</span></div>
              <div className="flex justify-between text-green-600"><span>Paid</span><span>{formatCurrency(parseFloat(form.paid_amount || 0))}</span></div>
              <div className="flex justify-between text-red-600"><span>Balance</span><span>{formatCurrency(balance)}</span></div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Purchase'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Purchase Detail Modal ─────────────────────────────────────────────
function PurchaseDetailModal({ purchaseId, onClose, onUpdated }) {
  const [payInput, setPayInput] = useState('')
  const [updating, setUpdating] = useState(false)
  const [showReceiveForm, setShowReceiveForm] = useState(false)
  const [receivedQtys, setReceivedQtys] = useState({})
  const [confirmNeverArrived, setConfirmNeverArrived] = useState(false)
  const qc = useQueryClient()

  const { data: purchase, isLoading } = useQuery({
    queryKey: ['purchase', purchaseId],
    queryFn: () => purchasesAPI.get(purchaseId).then(r => r.data),
    enabled: !!purchaseId,
  })

  useEffect(() => {
    if (purchase?.items) {
      const qtys = {}
      purchase.items.forEach(item => { qtys[item.id] = item.quantity })
      setReceivedQtys(qtys)
    }
  }, [purchase])

  const handleMarkReceived = async () => {
    setUpdating(true)
    try {
      const received_items = {}
      Object.entries(receivedQtys).forEach(([id, qty]) => {
        received_items[id] = parseFloat(qty) || 0
      })
      await purchasesAPI.update(purchaseId, { status: 'received', received_items })
      qc.invalidateQueries({ queryKey: ['purchase', purchaseId] })
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      toast.success('Marked as received — inventory updated')
      setShowReceiveForm(false)
      onUpdated?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  const handleNeverArrived = async () => {
    setUpdating(true)
    try {
      await purchasesAPI.update(purchaseId, { status: 'cancelled' })
      qc.invalidateQueries({ queryKey: ['purchase', purchaseId] })
      qc.invalidateQueries({ queryKey: ['purchases'] })
      toast.success('Marked as never arrived — balance cleared')
      setConfirmNeverArrived(false)
      onUpdated?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  const handleRecordPayment = async () => {
    const amount = parseFloat(payInput)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    setUpdating(true)
    try {
      const newPaid = (purchase.paid_amount || 0) + amount
      await purchasesAPI.update(purchaseId, { paid_amount: newPaid })
      qc.invalidateQueries({ queryKey: ['purchase', purchaseId] })
      qc.invalidateQueries({ queryKey: ['purchases'] })
      setPayInput('')
      toast.success('Payment recorded')
      onUpdated?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record payment')
    } finally {
      setUpdating(false)
    }
  }

  const deliveryBadge = (status) => {
    const map = { received: 'badge-green', pending: 'badge-yellow', approved: 'badge-blue', cancelled: 'badge-red' }
    return map[status] || 'badge-gray'
  }
  const deliveryLabel = (status) => {
    const map = { received: '✓ Received', pending: '⏳ Pending Delivery', cancelled: '✗ Never Arrived' }
    return map[status] || status
  }
  const paymentBadge = (status) => {
    const map = { paid: 'badge-green', partial: 'badge-yellow', unpaid: 'badge-red' }
    return map[status] || 'badge-gray'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold">{purchase?.purchase_number || 'Loading...'}</h3>
            {purchase && <p className="text-sm text-gray-500">{purchase.supplier_name} · {formatDate(purchase.invoice_date || purchase.created_at)}</p>}
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 py-10">Loading...</div>
        ) : purchase ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Never-arrived banner */}
            {purchase.status === 'cancelled' && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                <strong>Never Arrived</strong> — This order was marked as not delivered. No stock was added. No amount is owed.
                The original ordered amount of <strong>{formatCurrency(purchase.total_amount)}</strong> is shown below for reference only.
              </div>
            )}

            {/* Status badges + actions */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2">
                <span className={`badge ${deliveryBadge(purchase.status)} capitalize`}>
                  {deliveryLabel(purchase.status)}
                </span>
                {purchase.status !== 'cancelled' && (
                  <span className={`badge ${paymentBadge(purchase.payment_status)} capitalize`}>
                    {purchase.payment_status}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {purchase.status === 'pending' && !confirmNeverArrived && (
                  <>
                    <button
                      onClick={() => setShowReceiveForm(v => !v)}
                      disabled={updating}
                      className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-3"
                    >
                      <CheckCircle size={14} />
                      {showReceiveForm ? 'Cancel' : 'Mark as Received'}
                    </button>
                    <button
                      onClick={() => { setShowReceiveForm(false); setConfirmNeverArrived(true) }}
                      disabled={updating}
                      className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X size={14} />
                      Never Arrived
                    </button>
                  </>
                )}
                {confirmNeverArrived && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <span className="text-sm text-red-700 font-medium">Mark stock as never arrived? Balance will be cleared.</span>
                    <button
                      onClick={handleNeverArrived}
                      disabled={updating}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                    >
                      {updating ? 'Saving...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmNeverArrived(false)}
                      className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Subtotal', value: formatCurrency(purchase.subtotal), void: purchase.status === 'cancelled' },
                { label: 'Tax', value: formatCurrency(purchase.tax_amount), void: purchase.status === 'cancelled' },
                {
                  label: purchase.status === 'cancelled' ? 'Ordered (void)' : 'Total',
                  value: formatCurrency(purchase.total_amount),
                  bold: true,
                  void: purchase.status === 'cancelled',
                },
                {
                  label: purchase.status === 'cancelled' ? 'Effective Cost' : 'Balance Due',
                  value: purchase.status === 'cancelled' ? '₹0' : formatCurrency(purchase.balance_amount),
                  red: purchase.status !== 'cancelled' && purchase.balance_amount > 0,
                  green: purchase.status === 'cancelled',
                },
              ].map(({ label, value, bold, red, green, void: isVoid }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-sm font-semibold ${isVoid ? 'text-gray-300 line-through' : bold ? 'text-gray-900' : red ? 'text-red-600' : green ? 'text-green-600' : 'text-gray-700'}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Receive form — editable quantities per item */}
            {showReceiveForm && (
              <div className="border border-brand-200 rounded-xl p-4 bg-brand-50">
                <h4 className="font-semibold text-gray-800 mb-1">Confirm Received Quantities</h4>
                <p className="text-xs text-gray-500 mb-3">Enter how many of each item actually arrived. Leave as-is for full delivery.</p>
                <div className="space-y-2 mb-4">
                  {(purchase.items || []).map(item => (
                    <div key={item.id} className="flex items-center gap-3 text-sm">
                      <span className="flex-1 text-gray-800 font-medium">{item.product_name}</span>
                      <span className="text-gray-400 text-xs">Ordered: {Number(item.quantity).toFixed(2)}</span>
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-500">Received:</label>
                        <input
                          type="number"
                          className="input w-20 text-sm py-1"
                          value={receivedQtys[item.id] ?? item.quantity}
                          onChange={e => setReceivedQtys(q => ({ ...q, [item.id]: e.target.value }))}
                          min="0"
                          max={item.quantity}
                          step="0.01"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleMarkReceived}
                  disabled={updating}
                  className="btn-primary w-full"
                >
                  {updating ? 'Updating inventory...' : 'Confirm Receipt & Update Inventory'}
                </button>
              </div>
            )}

            {/* Items table */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5"><Package size={15} /> Items Purchased</h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="table-header">Product</th>
                      <th className="table-header text-right">Qty</th>
                      <th className="table-header text-right">Unit Cost</th>
                      <th className="table-header text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(purchase.items || []).map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="table-cell font-medium">{item.product_name}</td>
                        <td className="table-cell text-right">{Number(item.quantity).toFixed(2)}</td>
                        <td className="table-cell text-right">{formatCurrency(item.unit_cost)}</td>
                        <td className="table-cell text-right font-semibold">{formatCurrency(item.total_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Record payment — hidden for cancelled orders (nothing owed) */}
            {purchase.payment_status !== 'paid' && purchase.status !== 'cancelled' && (
              <div className="border border-gray-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5"><CreditCard size={15} /> Record Payment</h4>
                <div className="text-sm text-gray-500 mb-3">
                  Paid so far: <span className="font-semibold text-gray-800">{formatCurrency(purchase.paid_amount)}</span>
                  &nbsp;·&nbsp; Balance: <span className="font-semibold text-red-600">{formatCurrency(purchase.balance_amount)}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input flex-1"
                    placeholder={`Amount (max ${formatCurrency(purchase.balance_amount)})`}
                    value={payInput}
                    onChange={e => setPayInput(e.target.value)}
                    min="0.01"
                    step="0.01"
                  />
                  <button
                    onClick={handleRecordPayment}
                    disabled={updating}
                    className="btn-primary px-4 whitespace-nowrap"
                  >
                    {updating ? 'Saving...' : 'Record Payment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function Purchases() {
  const qc = useQueryClient()
  const { outlets } = useUserOutlets()
  const canExport = useAuthStore(s => s.hasAction('reports.export'))
  const [tab, setTab] = useState('purchases')
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [detailId, setDetailId] = useState(null)

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => purchasesAPI.listSuppliers().then(r => r.data) })
  const { data: products = [] } = useQuery({ queryKey: ['all-products'], queryFn: () => productsAPI.list({ per_page: 200 }).then(r => r.data.products) })
  const { data: purchaseData, isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => purchasesAPI.list().then(r => r.data),
  })

  const createSupplier = useMutation({
    mutationFn: (data) => purchasesAPI.createSupplier(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Supplier added') },
  })
  const createPurchase = useMutation({
    mutationFn: (data) => purchasesAPI.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Purchase recorded') },
  })

  const purchases = purchaseData?.purchases || []

  const handleExport = async () => {
    try {
      toast.loading('Preparing export...')
      const res = await purchasesAPI.list({ include_items: true })
      const allPurchases = res.data.purchases || []

      // Flatten: one row per item, purchase fields repeated
      const rows = []
      for (const p of allPurchases) {
        const items = p.items || []
        if (items.length === 0) {
          rows.push({
            purchase_number: p.purchase_number,
            invoice_number: p.invoice_number || '',
            invoice_date: p.invoice_date || '',
            supplier_name: p.supplier_name || '',
            delivery_status: p.status,
            payment_status: p.payment_status,
            product_name: '',
            quantity: '',
            unit_cost: '',
            item_total: '',
            tax_amount: p.tax_amount,
            total_amount: p.total_amount,
            paid_amount: p.paid_amount,
            balance_amount: p.balance_amount,
          })
        } else {
          items.forEach((item, idx) => {
            rows.push({
              purchase_number: p.purchase_number,
              invoice_number: p.invoice_number || '',
              invoice_date: p.invoice_date || '',
              supplier_name: p.supplier_name || '',
              delivery_status: p.status,
              payment_status: p.payment_status,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_cost: item.unit_cost,
              item_total: item.total_cost,
              tax_amount: idx === 0 ? p.tax_amount : '',
              total_amount: idx === 0 ? p.total_amount : '',
              paid_amount: idx === 0 ? p.paid_amount : '',
              balance_amount: idx === 0 ? p.balance_amount : '',
            })
          })
        }
      }

      const columns = [
        { key: 'purchase_number', label: 'Purchase #' },
        { key: 'invoice_number', label: 'Invoice #' },
        { key: 'invoice_date', label: 'Invoice Date' },
        { key: 'supplier_name', label: 'Supplier' },
        { key: 'delivery_status', label: 'Delivery Status' },
        { key: 'payment_status', label: 'Payment Status' },
        { key: 'product_name', label: 'Product' },
        { key: 'quantity', label: 'Qty', format: v => v !== '' ? Number(v).toFixed(2) : '' },
        { key: 'unit_cost', label: 'Unit Cost (₹)', format: v => v !== '' ? Number(v).toFixed(2) : '' },
        { key: 'item_total', label: 'Item Total (₹)', format: v => v !== '' ? Number(v).toFixed(2) : '' },
        { key: 'tax_amount', label: 'Tax (₹)', format: v => v !== '' ? Number(v).toFixed(2) : '' },
        { key: 'total_amount', label: 'Total (₹)', format: v => v !== '' ? Number(v).toFixed(2) : '' },
        { key: 'paid_amount', label: 'Paid (₹)', format: v => v !== '' ? Number(v).toFixed(2) : '' },
        { key: 'balance_amount', label: 'Balance (₹)', format: v => v !== '' ? Number(v).toFixed(2) : '' },
      ]

      const { exportToExcel } = await import('@/utils/exportExcel')
      exportToExcel(rows, columns, 'purchases_with_items')
      toast.dismiss()
      toast.success('Export ready')
    } catch {
      toast.dismiss()
      toast.error('Export failed')
    }
  }

  const deliveryBadge = (status) => {
    const map = { received: 'badge-green', pending: 'badge-yellow', approved: 'badge-blue', cancelled: 'badge-red' }
    return map[status] || 'badge-gray'
  }
  const deliveryLabel = (status) => {
    const map = { received: 'Received', pending: 'Pending', cancelled: 'Never Arrived' }
    return map[status] || status
  }
  const paymentBadge = (status) => {
    const map = { paid: 'badge-green', partial: 'badge-yellow', unpaid: 'badge-red' }
    return map[status] || 'badge-gray'
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
          <p className="text-sm text-gray-500">Stock purchase management</p>
        </div>
        <div className="flex gap-2">
          {tab === 'purchases' && canExport && (
            <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
              <Download size={16} /> Export Excel
            </button>
          )}
          {tab === 'suppliers' ? (
            <button onClick={() => setShowSupplierModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add Supplier
            </button>
          ) : (
            <button onClick={() => setShowPurchaseModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> New Purchase
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {[['purchases', 'Purchases'], ['suppliers', 'Suppliers']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'purchases' && (
        isLoading ? (
          <div className="text-center py-16 text-gray-400">Loading...</div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-600">No purchases yet</p>
            <button onClick={() => setShowPurchaseModal(true)} className="btn-primary mt-4">Record First Purchase</button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Purchase #</th>
                  <th className="table-header">Supplier</th>
                  <th className="table-header">Invoice No.</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Delivery</th>
                  <th className="table-header">Payment</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchases.map(p => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setDetailId(p.id)}
                  >
                    <td className="table-cell font-mono text-sm font-medium text-brand-600">{p.purchase_number}</td>
                    <td className="table-cell font-medium">{p.supplier_name || '—'}</td>
                    <td className="table-cell text-sm text-gray-500">{p.invoice_number || '—'}</td>
                    <td className="table-cell text-sm text-gray-500">{formatDate(p.invoice_date || p.created_at)}</td>
                    <td className="table-cell font-medium">
                      {p.status === 'cancelled' ? (
                        <span>
                          <span className="text-gray-400">₹0</span>
                          <span className="text-xs text-gray-300 line-through ml-1">{formatCurrency(p.total_amount)}</span>
                        </span>
                      ) : formatCurrency(p.total_amount)}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${deliveryBadge(p.status)} capitalize`}>
                        {deliveryLabel(p.status)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${paymentBadge(p.payment_status)} capitalize`}>{p.payment_status}</span>
                    </td>
                    <td className="table-cell text-gray-400"><ChevronRight size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'suppliers' && (
        suppliers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Truck size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-600">No suppliers yet</p>
            <button onClick={() => setShowSupplierModal(true)} className="btn-primary mt-4">Add First Supplier</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {suppliers.map(s => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900">{s.name}</h3>
                    <span className="text-xs text-gray-400">{s.supplier_code}</span>
                  </div>
                </div>
                {s.contact_person && <p className="text-sm text-gray-600 mb-1">{s.contact_person}</p>}
                {s.phone && <p className="text-sm text-gray-500">{s.phone}</p>}
                {s.email && <p className="text-sm text-gray-500">{s.email}</p>}
                {s.gstin && <p className="text-xs text-gray-400 mt-1 font-mono">GST: {s.gstin}</p>}
                {s.payment_terms && <p className="text-xs text-gray-400 mt-1">Payment: {s.payment_terms} days</p>}
              </div>
            ))}
          </div>
        )
      )}

      {showSupplierModal && (
        <SupplierModal onClose={() => setShowSupplierModal(false)} onSave={createSupplier.mutateAsync} />
      )}
      {showPurchaseModal && (
        <PurchaseModal
          outlets={outlets}
          suppliers={suppliers}
          products={products}
          onClose={() => setShowPurchaseModal(false)}
          onSave={createPurchase.mutateAsync}
        />
      )}
      {detailId && (
        <PurchaseDetailModal
          purchaseId={detailId}
          onClose={() => setDetailId(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ['purchases'] })}
        />
      )}
    </div>
  )
}
