import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, TrendingUp, Users, Receipt, Calendar } from 'lucide-react'
import { salonAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'

const PERIODS = [
  { value: 'today',      label: 'Today' },
  { value: 'week',       label: 'This Week' },
  { value: 'month',      label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
]

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        {Icon && (
          <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
            <Icon size={20} className="text-gray-400" />
          </div>
        )}
      </div>
    </div>
  )
}

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SalonSummary() {
  const { tenant } = useAuthStore()
  const [period, setPeriod] = useState('today')

  const { data: summary, isLoading } = useQuery({
    queryKey: ['salon-summary', tenant?.id, period],
    queryFn: () => salonAPI.getSummary({ period }).then(r => r.data),
    enabled: !!tenant?.id,
  })

  const { data: staffData = [], isLoading: staffLoading } = useQuery({
    queryKey: ['salon-summary-staff', tenant?.id, period],
    queryFn: () => salonAPI.getStaffSummary({ period }).then(r => r.data),
    enabled: !!tenant?.id,
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={24} />
            Summary
          </h1>
          <p className="text-gray-500 text-sm mt-1">Revenue and staff performance overview</p>
        </div>

        {/* Period selector */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p.value ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Revenue stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Revenue"
              value={formatCurrency(summary?.total_revenue)}
              icon={TrendingUp}
              color="text-brand-600"
            />
            <StatCard
              label="Total Bills"
              value={summary?.total_bills || 0}
              icon={Receipt}
              sub={summary?.total_bills > 0 ? `Avg ${formatCurrency((summary?.total_revenue || 0) / summary?.total_bills)}` : undefined}
            />
            <StatCard
              label="Cash Collected"
              value={formatCurrency(summary?.cash)}
              icon={Calendar}
              color="text-green-600"
            />
            <StatCard
              label="UPI / Card"
              value={formatCurrency((summary?.upi || 0) + (summary?.card || 0))}
              icon={Calendar}
              color="text-blue-600"
            />
          </div>

          {/* Payment breakdown */}
          {summary?.payment_breakdown && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Payment Breakdown</h3>
              <div className="space-y-3">
                {summary.payment_breakdown.map(item => {
                  const pct = summary.total_revenue > 0 ? (item.amount / summary.total_revenue * 100) : 0
                  return (
                    <div key={item.method}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize text-gray-600">{item.method}</span>
                        <span className="font-medium text-gray-900">{formatCurrency(item.amount)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top services */}
          {summary?.top_services && summary.top_services.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Top Services</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Service</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Count</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.top_services.map((svc, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{svc.name}</td>
                      <td className="px-5 py-3 text-gray-500">{svc.count}</td>
                      <td className="px-5 py-3 font-medium">{formatCurrency(svc.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Staff performance */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Staff Performance</h3>
            </div>
            {staffLoading ? (
              <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
            ) : staffData.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No bills with staff assigned in this period</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Staff</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Bills</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {staffData.map((s, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{s.name}</td>
                      <td className="px-5 py-3 text-gray-500">{s.bills}</td>
                      <td className="px-5 py-3 font-medium">{formatCurrency(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
