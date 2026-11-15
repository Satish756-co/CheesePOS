import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardAPI } from '@/api'
import { useUserOutlets } from '@/hooks/useUserOutlets'
import { formatCurrency, todayIST } from '@/utils/formatters'
import {
  CalendarDays, ChevronLeft, ChevronRight,
  ShoppingBag, Truck, TrendingDown, IndianRupee,
  Package, AlertCircle, Download,
} from 'lucide-react'

const TYPE_LABELS = { table: 'Table', counter: 'Counter', takeaway: 'Takeaway', delivery: 'Delivery' }
const TYPE_COLORS = {
  table: 'bg-blue-100 text-blue-700',
  counter: 'bg-orange-100 text-orange-700',
  takeaway: 'bg-yellow-100 text-yellow-700',
  delivery: 'bg-red-100 text-red-700',
}
const MODE_COLORS = {
  cash: 'bg-green-100 text-green-700',
  upi: 'bg-purple-100 text-purple-700',
  card: 'bg-blue-100 text-blue-700',
  credit: 'bg-red-100 text-red-700',
}
const CATEGORY_LABELS = {
  rent: 'Rent', electricity: 'Electricity', salaries: 'Salaries',
  maintenance: 'Maintenance', transport: 'Transport', cleaning: 'Cleaning', other: 'Other',
}

function fmtDate(dt) {
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function prevDay(d) {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() - 1)
  return fmtDate(dt)
}
function nextDay(d) {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() + 1)
  return fmtDate(dt)
}
function isToday(d) { return d === todayIST() }

function MetricCard({ icon: Icon, label, value, sub, color = 'text-brand-600', bg = 'bg-brand-50', empty }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start gap-4">
      <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={color} />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className={`text-xl font-bold ${empty ? 'text-gray-300' : 'text-gray-900'}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="text-center py-6 text-gray-400 text-sm">{message}</div>
  )
}

export default function DailySummary() {
  const { outlets } = useUserOutlets()
  const [date, setDate] = useState(todayIST())
  const [outletId, setOutletId] = useState('')

  const { data: summary, isLoading } = useQuery({
    queryKey: ['daily-summary', date, outletId],
    queryFn: () => dashboardAPI.getDaily({ date, outlet_id: outletId || undefined }).then(r => r.data),
    staleTime: 60_000,
  })

  const s = summary?.sales || {}
  const sr = summary?.stock_received || {}
  const sp = summary?.stock_pending || {}
  const ex = summary?.expenses || {}
  const movements = summary?.product_movements || []

  const totalCost = (sr.total_amount || 0) + (ex.total_amount || 0)

  async function handleExportMovements() {
    const { exportToExcel } = await import('@/utils/exportExcel')
    const rows = movements.map(m => ({
      'Product': m.product_name,
      'Qty Purchased': m.qty_purchased,
      'Qty Sold': m.qty_sold,
      'Net (In − Out)': m.net,
    }))
    exportToExcel(rows, `product-movements-${date}`)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays size={22} className="text-brand-500" /> Daily Summary
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Sales, stock arrivals, and expenses for the day</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {outlets.length > 1 && (
            <select
              className="input w-40 text-sm"
              value={outletId}
              onChange={e => setOutletId(e.target.value)}
            >
              <option value="">All Outlets</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}

          {/* Date navigation */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1 py-1">
            <button
              onClick={() => setDate(prevDay(date))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              className="border-0 outline-none text-sm font-medium text-gray-800 bg-transparent px-1"
              value={date}
              max={todayIST()}
              onChange={e => setDate(e.target.value)}
            />
            <button
              onClick={() => { if (!isToday(date)) setDate(nextDay(date)) }}
              disabled={isToday(date)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {!isToday(date) && (
            <button onClick={() => setDate(todayIST())} className="btn-secondary text-sm py-1.5 px-3">
              Today
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <>
          {/* Metric row */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              icon={IndianRupee}
              label="Total Revenue"
              value={formatCurrency(s.total_revenue || 0)}
              sub={`${s.total_bills || 0} bill${s.total_bills !== 1 ? 's' : ''} · avg ${formatCurrency(s.avg_bill || 0)}`}
              empty={!s.total_bills}
            />
            <MetricCard
              icon={ShoppingBag}
              label="Tax Collected"
              value={formatCurrency(s.tax_collected || 0)}
              sub={s.discount_given > 0 ? `Discount: ${formatCurrency(s.discount_given)}` : undefined}
              bg="bg-green-50"
              color="text-green-600"
              empty={!s.total_bills}
            />
            <MetricCard
              icon={Truck}
              label="Stock Received"
              value={formatCurrency(sr.total_amount || 0)}
              sub={`${sr.count || 0} deliver${sr.count !== 1 ? 'ies' : 'y'}`}
              bg="bg-blue-50"
              color="text-blue-600"
              empty={!sr.count}
            />
            <MetricCard
              icon={TrendingDown}
              label="Expenses"
              value={formatCurrency(ex.total_amount || 0)}
              sub={`${ex.count || 0} entry${ex.count !== 1 ? 's' : ''}`}
              bg="bg-red-50"
              color="text-red-600"
              empty={!ex.count}
            />
          </div>

          {/* Detail sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Sales ── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <IndianRupee size={16} className="text-brand-500" /> Sales Breakdown
              </h2>
              {!s.total_bills ? (
                <EmptyState message="No sales recorded for this day" />
              ) : (
                <div className="space-y-4">
                  {/* By billing type */}
                  {Object.keys(s.by_type || {}).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">By Type</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(s.by_type).map(([type, count]) => (
                          <span key={type} className={`px-3 py-1 rounded-full text-xs font-semibold ${TYPE_COLORS[type] || 'bg-gray-100 text-gray-600'}`}>
                            {TYPE_LABELS[type] || type}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment modes */}
                  {(s.payment_modes || []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Payment Modes</p>
                      <div className="space-y-2">
                        {s.payment_modes.map(pm => {
                          const pct = s.total_revenue > 0 ? (pm.total / s.total_revenue) * 100 : 0
                          return (
                            <div key={pm.mode}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${MODE_COLORS[pm.mode] || 'bg-gray-100 text-gray-600'}`}>
                                    {pm.mode.toUpperCase()}
                                  </span>
                                  <span className="text-gray-500 text-xs">{pm.count} txns</span>
                                </div>
                                <span className="font-semibold text-gray-800">{formatCurrency(pm.total)}</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-brand-400 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
                    <span className="text-gray-500">Net Revenue (excl. tax)</span>
                    <span className="font-bold text-gray-900">
                      {formatCurrency((s.total_revenue || 0) - (s.tax_collected || 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Stock Received ── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Truck size={16} className="text-blue-500" /> Stock Received Today
              </h2>
              {!sr.count ? (
                <EmptyState message="No deliveries recorded today" />
              ) : (
                <div className="space-y-3">
                  {(sr.purchases || []).map(p => (
                    <div key={p.purchase_number} className="border border-gray-100 rounded-xl overflow-hidden">
                      {/* Purchase header */}
                      <div className="flex items-start justify-between p-3 bg-gray-50">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{p.supplier_name || 'Unknown Supplier'}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{p.purchase_number}
                            {p.invoice_number ? ` · Inv: ${p.invoice_number}` : ''}
                          </p>
                        </div>
                        <span className="font-bold text-blue-700 text-sm">{formatCurrency(p.total_amount)}</span>
                      </div>
                      {/* Items list */}
                      {(p.items || []).length > 0 && (
                        <div className="divide-y divide-gray-50">
                          {p.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{item.product_name}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span className="font-medium text-gray-700">{item.quantity} {item.unit}</span>
                                <span>× {formatCurrency(item.unit_cost)}</span>
                                <span className="font-semibold text-gray-800">{formatCurrency(item.total)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-2 flex justify-between text-sm">
                    <span className="text-gray-500">Total Stock Cost</span>
                    <span className="font-bold text-blue-700">{formatCurrency(sr.total_amount)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Expenses ── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingDown size={16} className="text-red-500" /> Expenses Today
              </h2>
              {!ex.count ? (
                <EmptyState message="No expenses recorded today" />
              ) : (
                <div className="space-y-2">
                  {(ex.items || []).map((e, i) => (
                    <div key={i} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{e.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                            {CATEGORY_LABELS[e.category] || e.category}
                          </span>
                          <span className="text-xs text-gray-400 capitalize">{e.payment_mode}</span>
                        </div>
                      </div>
                      <span className="font-bold text-red-600 text-sm">{formatCurrency(e.amount)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-2 flex justify-between text-sm">
                    <span className="text-gray-500">Total Expenses</span>
                    <span className="font-bold text-red-600">{formatCurrency(ex.total_amount)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Pending Orders ── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                <AlertCircle size={16} className="text-yellow-500" /> Pending Orders
              </h2>
              <p className="text-xs text-gray-400 mb-4">All outstanding purchase orders not yet received</p>
              {!sp.count ? (
                <EmptyState message="No pending orders outstanding" />
              ) : (
                <div className="space-y-2">
                  {(sp.purchases || []).map(p => (
                    <div key={p.purchase_number} className="flex items-start justify-between border border-yellow-100 rounded-xl p-3 bg-yellow-50">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{p.supplier_name || 'Unknown Supplier'}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.purchase_number}
                          {p.invoice_number ? ` · Inv: ${p.invoice_number}` : ''}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Ordered: {p.invoice_date || '—'} · {p.items_count} item{p.items_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="font-bold text-yellow-700 text-sm">{formatCurrency(p.total_amount)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-2 flex justify-between text-sm">
                    <span className="text-gray-500">Total Awaited</span>
                    <span className="font-bold text-yellow-700">{formatCurrency(sp.total_amount)}</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Product Movements */}
          {movements.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <Package size={16} className="text-indigo-500" /> Product Movements
                </h2>
                <button
                  onClick={handleExportMovements}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <Download size={13} /> Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Product</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Purchased</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sold</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map(m => (
                      <tr key={m.product_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="py-2.5 font-medium text-gray-800">{m.product_name}</td>
                        <td className="py-2.5 text-right text-blue-600 font-semibold">
                          {m.qty_purchased > 0 ? `+${m.qty_purchased}` : '—'}
                        </td>
                        <td className="py-2.5 text-right text-orange-600 font-semibold">
                          {m.qty_sold > 0 ? m.qty_sold : '—'}
                        </td>
                        <td className={`py-2.5 text-right font-bold ${m.net > 0 ? 'text-green-600' : m.net < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {m.net > 0 ? `+${m.net}` : m.net}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Day total cost banner */}
          {(totalCost > 0 || s.total_revenue > 0) && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-wrap gap-6 items-center">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Revenue</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(s.total_revenue || 0)}</p>
              </div>
              <div className="text-2xl text-gray-200 font-light">−</div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Stock Cost + Expenses</p>
                <p className="text-2xl font-bold text-red-500">{formatCurrency(totalCost)}</p>
              </div>
              <div className="text-2xl text-gray-200 font-light">=</div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Estimated Day Profit</p>
                <p className={`text-2xl font-bold ${(s.total_revenue || 0) - totalCost >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
                  {formatCurrency((s.total_revenue || 0) - totalCost)}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
