import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminAPI } from '@/api'
import { formatCurrency, formatDate, todayIST, toISTDateString } from '@/utils/formatters'
import { TrendingUp, DollarSign, Receipt, BarChart3 } from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, color = 'text-brand-600', bg = 'bg-brand-50' }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl ${bg}`}>
          <Icon size={18} className={color} />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminRevenue() {
  const today = new Date()
  const firstDayOfMonth = toISTDateString(new Date(today.getFullYear(), today.getMonth(), 1))
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth)
  const [dateTo, setDateTo] = useState(todayIST())

  const { data, isLoading } = useQuery({
    queryKey: ['admin-revenue', dateFrom, dateTo],
    queryFn: () => adminAPI.getRevenue({ date_from: dateFrom, date_to: dateTo }).then(r => r.data),
  })

  const payments = data?.payments || []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
          <p className="text-sm text-gray-500">Subscription payment history</p>
        </div>
        <div className="flex gap-2">
          <input type="date" className="input w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-gray-400 pt-2.5 text-sm">to</span>
          <input type="date" className="input w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <StatCard icon={DollarSign} label="Total Revenue" value={formatCurrency(data?.total_revenue || 0)} bg="bg-green-50" color="text-green-600" />
            <StatCard icon={TrendingUp} label="Net Revenue" value={formatCurrency(data?.net_revenue || 0)} sub="After GST" />
            <StatCard icon={Receipt} label="GST Collected" value={formatCurrency(data?.gst_collected || 0)} bg="bg-orange-50" color="text-orange-600" />
            <StatCard icon={BarChart3} label="Payments" value={data?.payment_count || 0} sub="transactions" bg="bg-blue-50" color="text-blue-600" />
          </div>

          {payments.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
              <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-600">No payments in selected period</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="table-header">Date</th>
                    <th className="table-header">Tenant</th>
                    <th className="table-header">Plan</th>
                    <th className="table-header">Method</th>
                    <th className="table-header">Amount</th>
                    <th className="table-header">GST</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="table-cell text-sm text-gray-500">{formatDate(p.paid_at)}</td>
                      <td className="table-cell font-medium">{p.tenant_name || `Tenant #${p.tenant_id}`}</td>
                      <td className="table-cell text-sm text-gray-600">{p.plan_name || '—'}</td>
                      <td className="table-cell text-sm text-gray-500 capitalize">{p.payment_method || '—'}</td>
                      <td className="table-cell font-medium">{formatCurrency(p.total_amount)}</td>
                      <td className="table-cell text-sm text-gray-500">{formatCurrency(p.gst_amount)}</td>
                      <td className="table-cell">
                        <span className={`badge ${p.status === 'paid' ? 'badge-green' : 'badge-yellow'} capitalize`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
