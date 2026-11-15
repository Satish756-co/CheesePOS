import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ordersAPI } from '@/api'
import { useUserOutlets } from '@/hooks/useUserOutlets'
import { formatCurrency, formatDateTime, todayIST } from '@/utils/formatters'
import { exportToExcel, ORDERS_COLUMNS } from '@/utils/exportExcel'
import { useAuthStore } from '@/store/authStore'
import { ShoppingCart, X, ChevronRight, Download, TrendingUp, IndianRupee } from 'lucide-react'

const ALL_ORDERS_ROLES = ['owner', 'admin', 'accountant', 'manager']

const STATUS_STYLES = {
  open: 'badge-blue',
  order_placed: 'badge-blue',
  preparing: 'badge-yellow',
  ready: 'badge-orange',
  served: 'badge-gray',
  billed: 'badge-green',
  cancelled: 'badge-red',
}

const ORDER_TYPE_LABELS = {
  dine_in: 'Dine-in',
  counter: 'Counter',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
}

const ORDER_TYPE_BADGE = {
  dine_in: 'badge-blue',
  counter: 'badge-orange',
  takeaway: 'badge-yellow',
  delivery: 'badge-red',
}

function todayStr() {
  return todayIST()
}

function OrderDetailPanel({ order, canSeeAll, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{order.order_number}</h3>
            <p className="text-sm text-gray-500">{formatDateTime(order.created_at)}</p>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <span className={`badge ${STATUS_STYLES[order.status] || 'badge-gray'} capitalize`}>{order.status.replace('_', ' ')}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Order Type</p>
              <span className={`badge ${ORDER_TYPE_BADGE[order.order_type] || 'badge-gray'}`}>{ORDER_TYPE_LABELS[order.order_type] || order.order_type}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Outlet</p>
              <p className="text-sm font-medium">{order.outlet_name || '—'}</p>
            </div>
            {order.table_number && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Table</p>
                <p className="text-sm font-medium">{order.table_number}</p>
              </div>
            )}
            {order.customer_name && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Customer</p>
                <p className="text-sm font-medium">{order.customer_name}</p>
                {order.customer_phone && <p className="text-xs text-gray-400">{order.customer_phone}</p>}
              </div>
            )}
            {order.guest_count > 1 && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Guests</p>
                <p className="text-sm font-medium">{order.guest_count} pax</p>
              </div>
            )}
            {canSeeAll && order.waiter_name && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Taken by</p>
                <p className="text-sm font-medium">{order.waiter_name}</p>
              </div>
            )}
          </div>

          {order.notes && (
            <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
              <p className="text-xs text-yellow-700 font-medium mb-1">Notes</p>
              <p className="text-sm text-yellow-800">{order.notes}</p>
            </div>
          )}

          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Items ({(order.items || []).length})</h4>
            <div className="space-y-2">
              {(order.items || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
                    {item.special_instructions && (
                      <p className="text-xs text-gray-400 italic">"{item.special_instructions}"</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(item.net_amount)}</p>
                    <p className="text-xs text-gray-400">{item.quantity} × {formatCurrency(item.unit_price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-brand-50 rounded-xl p-3">
            <div className="flex justify-between font-bold text-base border-t border-brand-200 pt-1">
              <span>Order Total</span>
              <span>{formatCurrency(order.total_amount || order.net_amount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Orders() {
  const { outlets } = useUserOutlets()
  const canExport = useAuthStore(s => s.hasAction('reports.export'))
  const user = useAuthStore(s => s.user)
  const canSeeAll = user?.is_super_admin || ALL_ORDERS_ROLES.includes(user?.role)

  const [outletFilter, setOutletFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [selectedOrder, setSelectedOrder] = useState(null)

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', outletFilter, statusFilter, dateFrom, dateTo],
    queryFn: () => ordersAPI.list({
      outlet_id: outletFilter || undefined,
      status: statusFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }).then(r => r.data),
  })

  // Personal summary for non-privileged users
  const myTotalSales = orders.reduce((s, o) => s + (o.status !== 'cancelled' ? Number(o.total_amount || 0) : 0), 0)
  const myActiveOrders = orders.filter(o => !['billed', 'cancelled'].includes(o.status)).length
  const myBilledOrders = orders.filter(o => o.status === 'billed').length

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {canSeeAll ? 'Orders' : 'My Orders'}
          </h1>
          <p className="text-sm text-gray-500">
            {canSeeAll ? `${orders.length} orders` : `${orders.length} orders taken by you`}
          </p>
        </div>
        {canExport && (
          <button onClick={() => exportToExcel(orders, ORDERS_COLUMNS, 'orders')} className="btn-secondary flex items-center gap-2">
            <Download size={16} /> Export Excel
          </button>
        )}
      </div>

      {/* Personal summary for non-admin users */}
      {!canSeeAll && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <IndianRupee size={20} className="text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">My Total Sales</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(myTotalSales)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShoppingCart size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Active Orders</p>
              <p className="text-lg font-bold text-gray-900">{myActiveOrders}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Billed Orders</p>
              <p className="text-lg font-bold text-gray-900">{myBilledOrders}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {outlets.length > 1 && (
          <select className="input w-44" value={outletFilter} onChange={e => setOutletFilter(e.target.value)}>
            <option value="">All Outlets</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <select className="input w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="order_placed">Order Placed</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="served">Served</option>
          <option value="billed">Billed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div>
          <label className="label text-xs">From</label>
          <input type="date" className="input w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">To</label>
          <input type="date" className="input w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button
          className="btn-secondary text-sm self-end"
          onClick={() => { setDateFrom(''); setDateTo('') }}
        >
          All Dates
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600">No orders found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Order #</th>
                <th className="table-header">Channel</th>
                <th className="table-header">Outlet</th>
                <th className="table-header">Table</th>
                <th className="table-header">Customer</th>
                {canSeeAll && <th className="table-header">Taken By</th>}
                <th className="table-header">Items</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Status</th>
                <th className="table-header">Time</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                  <td className="table-cell font-mono text-sm font-medium text-brand-600">{order.order_number}</td>
                  <td className="table-cell">
                    <span className={`badge ${ORDER_TYPE_BADGE[order.order_type] || 'badge-gray'}`}>
                      {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
                    </span>
                  </td>
                  <td className="table-cell text-sm text-gray-600">{order.outlet_name || '—'}</td>
                  <td className="table-cell text-sm text-gray-500">{order.table_number || '—'}</td>
                  <td className="table-cell text-sm text-gray-600">{order.customer_name || '—'}</td>
                  {canSeeAll && (
                    <td className="table-cell text-sm text-gray-500">{order.waiter_name || '—'}</td>
                  )}
                  <td className="table-cell text-sm text-gray-500">{order.items?.length || 0} items</td>
                  <td className="table-cell font-medium">{formatCurrency(order.total_amount || order.net_amount)}</td>
                  <td className="table-cell">
                    <span className={`badge ${STATUS_STYLES[order.status] || 'badge-gray'} capitalize`}>{order.status.replace('_', ' ')}</span>
                  </td>
                  <td className="table-cell text-xs text-gray-400">{formatDateTime(order.created_at)}</td>
                  <td className="table-cell">
                    <ChevronRight size={16} className="text-gray-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          canSeeAll={canSeeAll}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  )
}
