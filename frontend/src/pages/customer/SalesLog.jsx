import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { billingAPI } from '@/api'
import { useUserOutlets } from '@/hooks/useUserOutlets'
import { formatCurrency, formatDateTime, todayIST } from '@/utils/formatters'
import { exportToExcel, SALES_LOG_COLUMNS } from '@/utils/exportExcel'
import { useAuthStore } from '@/store/authStore'
import BillReceipt from '@/components/BillReceipt'
import { Receipt, Table2, ShoppingBag, X, ChevronRight, TrendingUp, Download } from 'lucide-react'

const TYPE_BADGE = {
  table:    'bg-blue-100 text-blue-700 border border-blue-200',
  counter:  'bg-orange-100 text-orange-700 border border-orange-200',
  takeaway: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  delivery: 'bg-red-100 text-red-700 border border-red-200',
}

const TYPE_LABEL = {
  table: 'Table',
  counter: 'Counter',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
}

const PAYMENT_BADGE = {
  paid:    'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  pending: 'bg-red-100 text-red-700',
}

function today() {
  return todayIST()
}

export default function SalesLog() {
  const { outlets } = useUserOutlets()
  const canExport = useAuthStore(s => s.hasAction('reports.export'))

  const [outletFilter, setOutletFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [page, setPage] = useState(1)
  const [detailInvoice, setDetailInvoice] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await billingAPI.listInvoices({
        outlet_id: outletFilter || undefined,
        billing_type: typeFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        per_page: 5000,
      })
      exportToExcel(res.data.invoices, SALES_LOG_COLUMNS, `sales-log-${dateFrom || 'all'}-to-${dateTo || 'all'}`)
    } finally {
      setExporting(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['sales-log', outletFilter, typeFilter, dateFrom, dateTo, page],
    queryFn: () => billingAPI.listInvoices({
      outlet_id: outletFilter || undefined,
      billing_type: typeFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      per_page: 50,
    }).then(r => r.data),
    placeholderData: keepPreviousData,
  })

  const invoices = data?.invoices || []
  const totalPages = data?.pages || 1

  // Summary stats from current page
  const tableCount = invoices.filter(i => i.billing_type === 'table').length
  const counterCount = invoices.filter(i => i.billing_type === 'counter').length
  const totalRevenue = invoices.reduce((s, i) => s + i.total_amount, 0)

  const handleViewDetail = async (inv) => {
    setLoadingDetail(true)
    try {
      const res = await billingAPI.getInvoice(inv.id)
      setDetailInvoice(res.data)
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">All billing activity — table orders &amp; counter sales</p>
        </div>
        {canExport && (
          <button onClick={handleExport} disabled={exporting} className="btn-secondary flex items-center gap-2">
            <Download size={16} /> {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {outlets.length > 1 && (
          <div>
            <label className="label">Outlet</label>
            <select className="input w-40" value={outletFilter} onChange={e => { setOutletFilter(e.target.value); setPage(1) }}>
              <option value="">All Outlets</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Type</label>
          <select className="input w-36" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}>
            <option value="">All Types</option>
            <option value="table">Table</option>
            <option value="counter">Counter</option>
            <option value="takeaway">Takeaway</option>
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input w-36" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input w-36" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
        </div>
        <button
          onClick={() => { setDateFrom(today()); setDateTo(today()); setPage(1) }}
          className="btn-secondary text-sm py-2"
        >
          Today
        </button>
      </div>

      {/* Summary cards */}
      {!isLoading && invoices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Bills</p>
            <p className="text-2xl font-bold text-gray-900">{data?.total ?? invoices.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Revenue</p>
            <p className="text-2xl font-bold text-brand-600">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">this page</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Table2 size={13} className="text-blue-500" />
              <p className="text-xs text-blue-600 font-medium">Table Orders</p>
            </div>
            <p className="text-2xl font-bold text-blue-700">{tableCount}</p>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <ShoppingBag size={13} className="text-orange-500" />
              <p className="text-xs text-orange-600 font-medium">Counter Sales</p>
            </div>
            <p className="text-2xl font-bold text-orange-700">{counterCount}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Receipt size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600">No bills found for this period</p>
          <p className="text-sm mt-1">Try a different date range or filter</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Bill #</th>
                  <th className="table-header">Date &amp; Time</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Table / Customer</th>
                  {outlets.length > 1 && <th className="table-header">Outlet</th>}
                  <th className="table-header text-center">Items</th>
                  <th className="table-header text-right">Amount</th>
                  <th className="table-header">Payment</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map(inv => (
                  <tr
                    key={inv.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleViewDetail(inv)}
                  >
                    <td className="table-cell font-mono text-sm font-semibold text-brand-600">
                      {inv.invoice_number}
                    </td>
                    <td className="table-cell text-sm text-gray-700">
                      {formatDateTime(inv.created_at)}
                    </td>
                    <td className="table-cell">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[inv.billing_type] || 'bg-gray-100 text-gray-600'}`}>
                        {inv.billing_type === 'table' ? <Table2 size={10} /> : <ShoppingBag size={10} />}
                        {TYPE_LABEL[inv.billing_type] || inv.billing_type}
                      </span>
                    </td>
                    <td className="table-cell text-sm text-gray-700">
                      {inv.customer_name || '—'}
                    </td>
                    {outlets.length > 1 && (
                      <td className="table-cell text-sm text-gray-500">
                        {inv.outlet?.name || '—'}
                      </td>
                    )}
                    <td className="table-cell text-center text-sm text-gray-500">
                      {inv.items_count ?? '—'}
                    </td>
                    <td className="table-cell text-right font-semibold text-gray-900">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PAYMENT_BADGE[inv.payment_status] || 'bg-gray-100 text-gray-600'}`}>
                        {inv.payment_status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <ChevronRight size={16} className="text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages} · {data?.total} total
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail receipt modal */}
      {loadingDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-8 py-6 text-gray-600 font-medium">Loading bill…</div>
        </div>
      )}
      {detailInvoice && (
        <BillReceipt invoice={detailInvoice} onClose={() => setDetailInvoice(null)} />
      )}
    </div>
  )
}
