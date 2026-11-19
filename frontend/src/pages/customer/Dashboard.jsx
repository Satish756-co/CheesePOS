import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardAPI, salonAPI } from '@/api'
import { formatCurrency } from '@/utils/formatters'
import { useAuthStore } from '@/store/authStore'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  IndianRupee, ShoppingBag, TrendingDown,
  Wallet, CreditCard, Smartphone,
} from 'lucide-react'

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

  if (tenant?.business_type === 'saloon') {
    return <SalonDashboard />
  }

  return <BarDashboard />
}

function SalonDashboard() {
  const { tenant } = useAuthStore()

  const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const thisYear = new Date().getFullYear()
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const [period, setPeriod]             = useState('today')
  const [weekDate, setWeekDate]         = useState(todayISO())
  const [selMonth, setSelMonth]         = useState(new Date().getMonth() + 1)
  const [selMonthYear, setSelMonthYear] = useState(thisYear)
  const [selYear, setSelYear]           = useState(thisYear)
  const [customFrom, setCustomFrom]     = useState(todayISO())
  const [customTo, setCustomTo]         = useState(todayISO())

  const dateRange = useMemo(() => {
    switch (period) {
      case 'today':
        return { date_from: todayISO(), date_to: todayISO() }
      case 'week': {
        const d = new Date(weekDate + 'T00:00:00')
        const dayOfWeek = d.getDay() // 0=Sun
        const diffToMon = (dayOfWeek + 6) % 7
        const mon = new Date(d); mon.setDate(d.getDate() - diffToMon)
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
        return {
          date_from: mon.toISOString().slice(0, 10),
          date_to:   sun.toISOString().slice(0, 10),
        }
      }
      case 'month': {
        const lastDay = new Date(selMonthYear, selMonth, 0).getDate()
        const mm = String(selMonth).padStart(2, '0')
        return {
          date_from: `${selMonthYear}-${mm}-01`,
          date_to:   `${selMonthYear}-${mm}-${lastDay}`,
        }
      }
      case 'year':
        return { date_from: `${selYear}-01-01`, date_to: `${selYear}-12-31` }
      case 'custom':
        return { date_from: customFrom, date_to: customTo }
      default:
        return { date_from: todayISO(), date_to: todayISO() }
    }
  }, [period, weekDate, selMonth, selMonthYear, selYear, customFrom, customTo])

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'today':  return "Today's Overview"
      case 'week': {
        const from = new Date(dateRange.date_from + 'T00:00:00')
        const to   = new Date(dateRange.date_to   + 'T00:00:00')
        return `Week: ${from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
      }
      case 'month':  return `${MONTHS[selMonth - 1]} ${selMonthYear}`
      case 'year':   return `Year ${selYear}`
      case 'custom': return `${dateRange.date_from} → ${dateRange.date_to}`
      default:       return 'Overview'
    }
  }, [period, dateRange, selMonth, selMonthYear, selYear])

  const { data: summary, isLoading } = useQuery({
    queryKey: ['salon-summary', tenant?.id, dateRange],
    queryFn: () => salonAPI.getSummary(dateRange).then(r => r.data),
    enabled: !!tenant?.id,
    refetchInterval: period === 'today' ? 60000 : false,
  })

  const { data: staffData = [] } = useQuery({
    queryKey: ['salon-summary-staff', tenant?.id, dateRange],
    queryFn: () => salonAPI.getStaffSummary(dateRange).then(r => r.data),
    enabled: !!tenant?.id,
    refetchInterval: period === 'today' ? 60000 : false,
  })

  const { data: outletData } = useQuery({
    queryKey: ['salon-summary-outlets', tenant?.id, dateRange],
    queryFn: () => salonAPI.getSummaryAllOutlets(dateRange).then(r => r.data),
    enabled: !!tenant?.id,
  })

  const PERIODS = [
    { key: 'today',  label: 'Today' },
    { key: 'week',   label: 'Week' },
    { key: 'month',  label: 'Month' },
    { key: 'year',   label: 'Year' },
    { key: 'custom', label: 'Custom' },
  ]

  const yearOptions = Array.from({ length: 5 }, (_, i) => thisYear - 2 + i)

  return (
    <div className="p-6 space-y-6">
      {/* Header + period selector */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{periodLabel}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{tenant?.business_name}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Period tabs */}
          <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  period === p.key ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Sub-selector row */}
          {period === 'week' && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-gray-500">Pick any day:</span>
              <input
                type="date"
                className="input py-1 text-xs w-36"
                value={weekDate}
                onChange={e => setWeekDate(e.target.value)}
              />
            </div>
          )}
          {period === 'month' && (
            <div className="flex items-center gap-2 text-sm">
              <select
                className="input py-1 text-xs"
                value={selMonth}
                onChange={e => setSelMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <input
                type="number"
                className="input py-1 text-xs w-20"
                min="2020"
                max="2099"
                value={selMonthYear}
                onChange={e => setSelMonthYear(Number(e.target.value))}
              />
            </div>
          )}
          {period === 'year' && (
            <select
              className="input py-1 text-xs"
              value={selYear}
              onChange={e => setSelYear(Number(e.target.value))}
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {period === 'custom' && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date"
                className="input py-1 text-xs w-36"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                className="input py-1 text-xs w-36"
                value={customTo}
                min={customFrom}
                onChange={e => setCustomTo(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Revenue</p>
                <div className="p-2 rounded-lg bg-gray-50 text-brand-500"><IndianRupee size={18} /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary?.total_revenue || 0)}</p>
              {(summary?.profit != null) && (
                <p className={`text-xs mt-0.5 ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Profit: {formatCurrency(summary.profit)}</p>
              )}
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Bills</p>
                <div className="p-2 rounded-lg bg-gray-50 text-blue-500"><ShoppingBag size={18} /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary?.total_bills || 0}</p>
              {(summary?.total_bills > 0) && (
                <p className="text-xs text-gray-400">Avg {formatCurrency((summary?.total_revenue || 0) / summary.total_bills)}</p>
              )}
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Cash</p>
                <div className="p-2 rounded-lg bg-gray-50 text-green-500"><Wallet size={18} /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary?.cash || 0)}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">UPI / Card</p>
                <div className="p-2 rounded-lg bg-gray-50 text-purple-500"><Smartphone size={18} /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency((summary?.upi || 0) + (summary?.card || 0))}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Top services */}
            {summary?.top_services?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Top Services</h3>
                </div>
                <div className="p-4 space-y-2">
                  {summary.top_services.slice(0, 5).map((svc, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{svc.name}</span>
                      <div className="text-right">
                        <span className="font-medium text-gray-900">{formatCurrency(svc.revenue)}</span>
                        <span className="text-gray-400 ml-2">×{svc.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Staff performance */}
            {staffData.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Staff Performance</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {staffData.map((s, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900">{s.name}</span>
                      <div className="text-right">
                        <span className="font-medium">{formatCurrency(s.revenue)}</span>
                        <span className="text-gray-400 ml-2">{s.bills} bill{s.bills !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!summary?.top_services?.length && !staffData.length && (
              <div className="md:col-span-2 text-center py-10 bg-white border border-dashed border-gray-200 rounded-xl text-gray-400">
                <p className="text-sm">No bills found for this period.</p>
              </div>
            )}
          </div>

          {/* Per-outlet breakdown — only when 2+ outlets */}
          {outletData?.outlets?.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Revenue by Outlet</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Outlet</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Revenue</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Bills</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Expenses</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {outletData.outlets.map((o, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{o.outlet_name}</td>
                        <td className="px-5 py-3 text-right text-gray-900">{formatCurrency(o.revenue)}</td>
                        <td className="px-5 py-3 text-right text-gray-500">{o.bills}</td>
                        <td className="px-5 py-3 text-right text-red-500">{formatCurrency(o.expenses)}</td>
                        <td className={`px-5 py-3 text-right font-medium ${o.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(o.profit)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                      <td className="px-5 py-3 text-gray-900">Total</td>
                      <td className="px-5 py-3 text-right text-gray-900">{formatCurrency(outletData.total_revenue)}</td>
                      <td className="px-5 py-3 text-right text-gray-500">
                        {outletData.outlets.reduce((s, o) => s + o.bills, 0)}
                      </td>
                      <td className="px-5 py-3 text-right text-red-500">{formatCurrency(outletData.total_expenses)}</td>
                      <td className={`px-5 py-3 text-right ${outletData.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(outletData.total_profit)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function BarDashboard() {
  const { tenant } = useAuthStore()

  const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const thisYear = new Date().getFullYear()
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const [period, setPeriod]             = useState('today')
  const [weekDate, setWeekDate]         = useState(todayISO())
  const [selMonth, setSelMonth]         = useState(new Date().getMonth() + 1)
  const [selMonthYear, setSelMonthYear] = useState(thisYear)
  const [selYear, setSelYear]           = useState(thisYear)
  const [customFrom, setCustomFrom]     = useState(todayISO())
  const [customTo, setCustomTo]         = useState(todayISO())
  const [chartPeriod, setChartPeriod]   = useState('week')

  const dateRange = useMemo(() => {
    switch (period) {
      case 'today':
        return { date_from: todayISO(), date_to: todayISO() }
      case 'week': {
        const d = new Date(weekDate + 'T00:00:00')
        const dayOfWeek = d.getDay()
        const diffToMon = (dayOfWeek + 6) % 7
        const mon = new Date(d); mon.setDate(d.getDate() - diffToMon)
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
        return {
          date_from: mon.toISOString().slice(0, 10),
          date_to:   sun.toISOString().slice(0, 10),
        }
      }
      case 'month': {
        const lastDay = new Date(selMonthYear, selMonth, 0).getDate()
        const mm = String(selMonth).padStart(2, '0')
        return {
          date_from: `${selMonthYear}-${mm}-01`,
          date_to:   `${selMonthYear}-${mm}-${lastDay}`,
        }
      }
      case 'year':
        return { date_from: `${selYear}-01-01`, date_to: `${selYear}-12-31` }
      case 'custom':
        return { date_from: customFrom, date_to: customTo }
      default:
        return { date_from: todayISO(), date_to: todayISO() }
    }
  }, [period, weekDate, selMonth, selMonthYear, selYear, customFrom, customTo])

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'today':  return "Today's Overview"
      case 'week': {
        const from = new Date(dateRange.date_from + 'T00:00:00')
        const to   = new Date(dateRange.date_to   + 'T00:00:00')
        return `Week: ${from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
      }
      case 'month':  return `${MONTHS[selMonth - 1]} ${selMonthYear}`
      case 'year':   return `Year ${selYear}`
      case 'custom': return `${dateRange.date_from} → ${dateRange.date_to}`
      default:       return 'Dashboard'
    }
  }, [period, dateRange, selMonth, selMonthYear, selYear])

  const PERIODS = [
    { key: 'today',  label: 'Today' },
    { key: 'week',   label: 'Week' },
    { key: 'month',  label: 'Month' },
    { key: 'year',   label: 'Year' },
    { key: 'custom', label: 'Custom' },
  ]
  const yearOptions = Array.from({ length: 5 }, (_, i) => thisYear - 2 + i)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary', tenant?.id, dateRange],
    queryFn: () => dashboardAPI.getSummary(dateRange).then(r => r.data),
    enabled: !!tenant?.id,
    refetchInterval: period === 'today' ? 60000 : false,
  })

  const { data: salesChart } = useQuery({
    queryKey: ['sales-chart', chartPeriod],
    queryFn: () => dashboardAPI.getSalesChart({ period: chartPeriod }).then(r => r.data),
  })

  const { data: topProducts } = useQuery({
    queryKey: ['top-products', tenant?.id, dateRange],
    queryFn: () => dashboardAPI.getTopProducts({ ...dateRange, limit: 5 }).then(r => r.data),
    enabled: !!tenant?.id,
  })

  const { data: outletComparison } = useQuery({
    queryKey: ['outlet-comparison', tenant?.id, dateRange],
    queryFn: () => dashboardAPI.getOutletComparison(dateRange).then(r => r.data),
    enabled: !!tenant?.id,
  })

  const s = summary || {}

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header + period selector */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{periodLabel}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{tenant?.business_name}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Period tabs */}
          <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  period === p.key ? 'bg-brand-500 text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Sub-selectors */}
          {period === 'week' && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-gray-500">Pick any day:</span>
              <input
                type="date"
                className="input py-1 text-xs w-36"
                value={weekDate}
                onChange={e => setWeekDate(e.target.value)}
              />
            </div>
          )}
          {period === 'month' && (
            <div className="flex items-center gap-2 text-sm">
              <select
                className="input py-1 text-xs"
                value={selMonth}
                onChange={e => setSelMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <input
                type="number"
                className="input py-1 text-xs w-20"
                min="2020"
                max="2099"
                value={selMonthYear}
                onChange={e => setSelMonthYear(Number(e.target.value))}
              />
            </div>
          )}
          {period === 'year' && (
            <select
              className="input py-1 text-xs"
              value={selYear}
              onChange={e => setSelYear(Number(e.target.value))}
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {period === 'custom' && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date"
                className="input py-1 text-xs w-36"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                className="input py-1 text-xs w-36"
                value={customTo}
                min={customFrom}
                onChange={e => setCustomTo(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <>
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
            {/* Sales trend — independent rolling-window period selector */}
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
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: CHART_COLORS[i] }}
                    >
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

          {/* Per-outlet breakdown — only when 2+ outlets */}
          {(outletComparison || []).length > 1 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Revenue by Outlet</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Outlet</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Revenue</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Bills</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Expenses</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {outletComparison.map((o, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{o.outlet_name}</td>
                        <td className="px-5 py-3 text-right text-gray-900">{formatCurrency(o.sales)}</td>
                        <td className="px-5 py-3 text-right text-gray-500">{o.bills}</td>
                        <td className="px-5 py-3 text-right text-red-500">{formatCurrency(o.expenses)}</td>
                        <td className={`px-5 py-3 text-right font-medium ${o.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(o.profit)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                      <td className="px-5 py-3 text-gray-900">Total</td>
                      <td className="px-5 py-3 text-right text-gray-900">{formatCurrency(outletComparison.reduce((sum, o) => sum + o.sales, 0))}</td>
                      <td className="px-5 py-3 text-right text-gray-500">{outletComparison.reduce((sum, o) => sum + o.bills, 0)}</td>
                      <td className="px-5 py-3 text-right text-red-500">{formatCurrency(outletComparison.reduce((sum, o) => sum + o.expenses, 0))}</td>
                      <td className={`px-5 py-3 text-right ${outletComparison.reduce((sum, o) => sum + o.profit, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(outletComparison.reduce((sum, o) => sum + o.profit, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
