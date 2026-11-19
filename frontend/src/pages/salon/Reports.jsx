import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { salonAPI, outletsAPI } from '@/api'
import { formatCurrency } from '@/utils/formatters'
import { useAuthStore } from '@/store/authStore'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { Download } from 'lucide-react'
import { exportToExcel } from '@/utils/exportExcel'

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#f59e0b']
const TABS = ['sales', 'services', 'payments', 'staff']

export default function SalonReports() {
  const canExport = useAuthStore(s => s.hasAction('reports.export'))
  const { tenant } = useAuthStore()
  const [activeTab, setActiveTab] = useState('sales')
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedOutlet, setSelectedOutlet] = useState(null)

  const { data: outlets } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletsAPI.list().then(r => r.data),
  })

  const params = {
    date_from: dateFrom,
    date_to: dateTo,
    ...(selectedOutlet ? { outlet_id: selectedOutlet } : {}),
  }

  const { data: summary, isLoading } = useQuery({
    queryKey: ['salon-report-summary', params],
    queryFn: () => salonAPI.getSummary(params).then(r => r.data),
    enabled: !!tenant?.id,
  })

  const { data: dailyData = [] } = useQuery({
    queryKey: ['salon-report-daily', params],
    queryFn: () => salonAPI.getReportsDaily(params).then(r => r.data),
    enabled: !!tenant?.id && activeTab === 'sales',
  })

  const { data: servicesData = [] } = useQuery({
    queryKey: ['salon-report-services', params],
    queryFn: () => salonAPI.getReportsServices(params).then(r => r.data),
    enabled: !!tenant?.id && activeTab === 'services',
  })

  const { data: staffData = [] } = useQuery({
    queryKey: ['salon-report-staff', params],
    queryFn: () => salonAPI.getStaffSummary(params).then(r => r.data),
    enabled: !!tenant?.id && activeTab === 'staff',
  })

  const handleExport = () => {
    if (activeTab === 'sales' && dailyData.length) {
      exportToExcel(
        dailyData,
        [
          { key: 'date', label: 'Date' },
          { key: 'bills', label: 'Bills' },
          { key: 'revenue', label: 'Revenue (₹)', format: v => Number(v).toFixed(2) },
        ],
        `salon-daily-sales-${dateFrom}-to-${dateTo}`,
      )
    } else if (activeTab === 'services' && servicesData.length) {
      exportToExcel(
        servicesData,
        [
          { key: 'name', label: 'Service / Package' },
          { key: 'type', label: 'Type', format: v => v === 'service' ? 'Service' : 'Package' },
          { key: 'count', label: 'Count' },
          { key: 'revenue', label: 'Revenue (₹)', format: v => Number(v).toFixed(2) },
        ],
        `salon-services-${dateFrom}-to-${dateTo}`,
      )
    } else if (activeTab === 'payments' && summary?.payment_breakdown?.length) {
      exportToExcel(
        summary.payment_breakdown,
        [
          { key: 'method', label: 'Payment Mode' },
          { key: 'amount', label: 'Amount (₹)', format: v => Number(v).toFixed(2) },
        ],
        `salon-payments-${dateFrom}-to-${dateTo}`,
      )
    } else if (activeTab === 'staff' && staffData.length) {
      exportToExcel(
        staffData,
        [
          { key: 'name', label: 'Staff' },
          { key: 'bills', label: 'Bills' },
          { key: 'revenue', label: 'Revenue (₹)', format: v => Number(v).toFixed(2) },
          { key: 'revenue', label: 'Avg Bill (₹)', format: (v, row) => row.bills > 0 ? Number(v / row.bills).toFixed(2) : '0.00' },
        ],
        `salon-staff-${dateFrom}-to-${dateTo}`,
      )
    }
  }

  const paymentData = (summary?.payment_breakdown || []).filter(p => p.amount > 0)
  const totalPayments = paymentData.reduce((s, p) => s + p.amount, 0)
  const profit = summary?.profit ?? 0

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500">Salon business performance insights</p>
        </div>
        {canExport && (
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> Export
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="date"
          className="input w-36"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
        />
        <input
          type="date"
          className="input w-36"
          value={dateTo}
          min={dateFrom}
          onChange={e => setDateTo(e.target.value)}
        />
        {outlets && outlets.length > 1 && (
          <select
            className="input w-44"
            value={selectedOutlet || ''}
            onChange={e => setSelectedOutlet(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">All outlets</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors
                ${activeTab === t ? 'bg-brand-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sales tab ── */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary?.total_revenue)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-gray-500">Total Bills</p>
              <p className="text-2xl font-bold text-gray-900">{summary?.total_bills || 0}</p>
              {summary?.total_bills > 0 && (
                <p className="text-xs text-gray-400">
                  Avg {formatCurrency((summary.total_revenue || 0) / summary.total_bills)}
                </p>
              )}
            </div>
            <div className="stat-card border-l-4 border-red-400">
              <p className="text-sm text-gray-500">Expenses</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(summary?.total_expenses)}</p>
            </div>
            <div className={`stat-card border-l-4 ${profit >= 0 ? 'border-green-500' : 'border-red-600'}`}>
              <p className="text-sm text-gray-500">Net Profit</p>
              <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(profit)}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : dailyData.length > 0 ? (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Daily Revenue</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="#f97316" fill="#fff7ed" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="card text-center py-10 text-gray-400">
              <p className="text-sm">No bills found for this period.</p>
            </div>
          )}

          {summary && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Income Statement</h3>
              <div className="space-y-0 text-sm max-w-md">
                <div className="flex justify-between py-2 px-1">
                  <span className="text-gray-600">Total Revenue</span>
                  <span className="font-medium text-gray-900">{formatCurrency(summary.total_revenue)}</span>
                </div>
                <div className="border-t border-gray-200 my-1" />
                <div className="flex justify-between py-2 px-1 text-red-500">
                  <span>Less: Expenses</span>
                  <span>({formatCurrency(summary.total_expenses)})</span>
                </div>
                <div className="border-t border-gray-200 my-1" />
                <div className={`flex justify-between py-2 px-1 font-semibold text-base ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span>Net Profit / (Loss)</span>
                  <span>{formatCurrency(profit)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Services tab ── */}
      {activeTab === 'services' && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Service & Package Performance</h3>
          {servicesData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No bills found for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Service / Package</th>
                    <th className="table-header">Type</th>
                    <th className="table-header text-right">Count</th>
                    <th className="table-header text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {servicesData.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{item.name}</td>
                      <td className="table-cell text-gray-500 capitalize">{item.type}</td>
                      <td className="table-cell text-right">{item.count}</td>
                      <td className="table-cell text-right font-bold text-brand-600">
                        {formatCurrency(item.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Payments tab ── */}
      {activeTab === 'payments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Payment Mode Breakdown</h3>
            {paymentData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No bills found for this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    dataKey="amount"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                  >
                    {paymentData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={v => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">By Amount</h3>
            {paymentData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No data.</p>
            ) : (
              <div className="space-y-3">
                {paymentData.map((p, i) => {
                  const pct = totalPayments > 0 ? (p.amount / totalPayments * 100) : 0
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{p.method}</span>
                          <span className="text-sm font-bold">{formatCurrency(p.amount)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${pct.toFixed(1)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Staff tab ── */}
      {activeTab === 'staff' && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Staff Performance</h3>
          {staffData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              No bills with assigned staff in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Staff</th>
                    <th className="table-header text-right">Bills</th>
                    <th className="table-header text-right">Revenue</th>
                    <th className="table-header text-right">Avg Bill</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {staffData.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{s.name}</td>
                      <td className="table-cell text-right text-gray-500">{s.bills}</td>
                      <td className="table-cell text-right font-bold text-brand-600">
                        {formatCurrency(s.revenue)}
                      </td>
                      <td className="table-cell text-right text-gray-500">
                        {formatCurrency(s.bills > 0 ? s.revenue / s.bills : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
