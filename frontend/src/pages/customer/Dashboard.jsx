import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardAPI } from '@/api'
import { formatCurrency, formatDate, todayIST, toISTDateString } from '@/utils/formatters'
import { useAuthStore } from '@/store/authStore'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  IndianRupee, ShoppingBag, TrendingUp, TrendingDown,
  Wallet, CreditCard, Smartphone, Clock, RefreshCw
} from 'lucide-react'
import { subDays } from 'date-fns'

const CHART_COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#f59e0b']

function StatCard({ label, value, icon: Icon, color = 'text-brand-500', subtext, trend }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        <div className={`p-2 rounded-lg bg-gray-50 ${color}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
    </div>
  )
}

export default function CustomerDashboard() {
  const { tenant } = useAuthStore()
  const [dateRange, setDateRange] = useState('today')
  const [chartPeriod, setChartPeriod] = useState('week')

  const dateParams = {
    today: { date_from: todayIST(), date_to: todayIST() },
    yesterday: { date_from: toISTDateString(subDays(new Date(), 1)), date_to: toISTDateString(subDays(new Date(), 1)) },
    week: { date_from: toISTDateString(subDays(new Date(), 7)), date_to: todayIST() },
    month: { date_from: toISTDateString(subDays(new Date(), 30)), date_to: todayIST() },
  }

  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-summary', dateRange],
    queryFn: () => dashboardAPI.getSummary(dateParams[dateRange]).then(r => r.data),
  })

  const { data: salesChart } = useQuery({
    queryKey: ['sales-chart', chartPeriod],
    queryFn: () => dashboardAPI.getSalesChart({ period: chartPeriod }).then(r => r.data),
  })

  const { data: topProducts } = useQuery({
    queryKey: ['top-products'],
    queryFn: () => dashboardAPI.getTopProducts({ limit: 5 }).then(r => r.data),
  })

  const { data: outletComparison } = useQuery({
    queryKey: ['outlet-comparison'],
    queryFn: () => dashboardAPI.getOutletComparison().then(r => r.data),
  })

  const s = summary || {}

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">{tenant?.business_name} • Live overview</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
            {['today', 'yesterday', 'week', 'month'].map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors
                  ${dateRange === range ? 'bg-brand-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {range}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} className="btn-secondary p-2">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total Sales"
          value={formatCurrency(s.today_sales)}
          icon={IndianRupee}
          color="text-brand-500"
          subtext={`${s.total_bills || 0} bills`}
        />
        <StatCard
          label="Cash"
          value={formatCurrency(s.cash_collection)}
          icon={Wallet}
          color="text-green-500"
        />
        <StatCard
          label="UPI"
          value={formatCurrency(s.upi_collection)}
          icon={Smartphone}
          color="text-blue-500"
        />
        <StatCard
          label="Card"
          value={formatCurrency(s.card_collection)}
          icon={CreditCard}
          color="text-purple-500"
        />
        <StatCard
          label="Expenses"
          value={formatCurrency(s.total_expenses)}
          icon={TrendingDown}
          color="text-red-500"
          subtext={`Net: ${formatCurrency(s.net_sales)}`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sales trend */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Sales Trend</h3>
            <div className="flex gap-1">
              {['week', 'month', 'year'].map(p => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={`px-2.5 py-1 rounded text-xs font-medium capitalize
                    ${chartPeriod === p ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={salesChart || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Area type="monotone" dataKey="sales" stroke="#f97316" fill="#fff7ed" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Top Selling</h3>
          <div className="space-y-3">
            {(topProducts || []).slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white`}
                  style={{ backgroundColor: CHART_COLORS[i] }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.product_name}</p>
                  <p className="text-xs text-gray-400">{p.quantity} sold</p>
                </div>
                <p className="text-sm font-bold text-gray-900">{formatCurrency(p.revenue)}</p>
              </div>
            ))}
            {(!topProducts || topProducts.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">No sales data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Outlet Comparison */}
      {(outletComparison || []).length > 1 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Outlet Performance (Last 30 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={outletComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="outlet_name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Bar dataKey="sales" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
