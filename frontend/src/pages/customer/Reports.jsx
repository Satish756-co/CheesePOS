import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsAPI, outletsAPI } from '@/api'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { useAuthStore } from '@/store/authStore'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, subDays } from 'date-fns'
import { Download, BarChart2, TrendingUp, TrendingDown, IndianRupee } from 'lucide-react'
import { exportToExcel, REPORT_PRODUCT_SALES_COLUMNS, REPORT_DAILY_SALES_COLUMNS, REPORT_PAYMENT_MODES_COLUMNS } from '@/utils/exportExcel'

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#f59e0b']

const REPORTS = ['sales', 'products', 'payments', 'profit']

function PLRow({ label, amount, isDeduct, bold, large, colored }) {
  const isNeg = amount < 0
  const color = colored ? (amount >= 0 ? 'text-green-600' : 'text-red-600') : isDeduct ? 'text-red-500' : 'text-gray-900'
  return (
    <div className={`flex justify-between py-2 px-1 ${bold ? 'font-semibold' : ''} ${large ? 'text-base' : 'text-sm'}`}>
      <span className="text-gray-600">{label}</span>
      <span className={color}>{isNeg ? `(${formatCurrency(Math.abs(amount))})` : formatCurrency(amount)}</span>
    </div>
  )
}

function PLDivider() {
  return <div className="border-t border-gray-200 my-1" />
}

export default function Reports() {
  const canExport = useAuthStore(s => s.hasAction('reports.export'))
  const [activeReport, setActiveReport] = useState('sales')
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedOutlet, setSelectedOutlet] = useState(null)

  const { data: outlets } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletsAPI.list().then(r => r.data),
  })

  const params = { date_from: dateFrom, date_to: dateTo, outlet_id: selectedOutlet }

  const { data: salesData } = useQuery({
    queryKey: ['report-sales', params],
    queryFn: () => reportsAPI.sales(params).then(r => r.data),
    enabled: activeReport === 'sales',
  })

  const { data: productData } = useQuery({
    queryKey: ['report-products', params],
    queryFn: () => reportsAPI.productSales(params).then(r => r.data),
    enabled: activeReport === 'products',
  })

  const { data: paymentData } = useQuery({
    queryKey: ['report-payments', params],
    queryFn: () => reportsAPI.paymentModes(params).then(r => r.data),
    enabled: activeReport === 'payments',
  })

  const { data: plData } = useQuery({
    queryKey: ['report-pl', params],
    queryFn: () => reportsAPI.profitLoss(params).then(r => r.data),
    enabled: activeReport === 'profit',
  })

  const handleExport = () => {
    if (activeReport === 'sales') {
      exportToExcel(salesData?.daily || [], REPORT_DAILY_SALES_COLUMNS, `sales-report-${dateFrom}-to-${dateTo}`)
    } else if (activeReport === 'products') {
      exportToExcel(productData || [], REPORT_PRODUCT_SALES_COLUMNS, `product-sales-${dateFrom}-to-${dateTo}`)
    } else if (activeReport === 'payments') {
      exportToExcel(paymentData || [], REPORT_PAYMENT_MODES_COLUMNS, `payments-${dateFrom}-to-${dateTo}`)
    } else if (activeReport === 'profit' && plData) {
      const rows = [
        { label: 'Gross Revenue', amount: plData.gross_revenue },
        { label: 'Tax Collected', amount: -plData.tax_collected },
        { label: 'Net Revenue', amount: plData.net_revenue },
        { label: 'Stock Purchases (COGS)', amount: -plData.total_purchases },
        { label: 'Gross Profit', amount: plData.gross_profit },
        { label: 'Operating Expenses', amount: -plData.total_expenses },
        { label: 'Net Profit', amount: plData.net_profit },
        { label: 'Profit Margin (%)', amount: plData.profit_margin },
      ]
      exportToExcel(rows, [{ key: 'label', label: 'Item' }, { key: 'amount', label: 'Amount (₹)', format: v => Number(v).toFixed(2) }], `profit-loss-${dateFrom}-to-${dateTo}`)
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500">Business performance insights</p>
        </div>
        {canExport && (
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> Export
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input type="date" className="input w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <input type="date" className="input w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        {outlets && outlets.length > 1 && (
          <select className="input w-44" value={selectedOutlet || ''} onChange={e => setSelectedOutlet(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">All outlets</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
          {REPORTS.map(r => (
            <button key={r} onClick={() => setActiveReport(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors
                ${activeReport === r ? 'bg-brand-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Report */}
      {activeReport === 'sales' && salesData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesData.summary?.total_sales)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-gray-500">Total Bills</p>
              <p className="text-2xl font-bold text-gray-900">{salesData.summary?.total_bills}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-gray-500">Tax Collected</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesData.summary?.total_tax)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-gray-500">Avg Bill Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesData.summary?.avg_bill_value)}</p>
            </div>
          </div>
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Daily Sales</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={salesData.daily || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Area type="monotone" dataKey="sales" stroke="#f97316" fill="#fff7ed" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Product Sales */}
      {activeReport === 'products' && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Product-wise Sales</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Product</th>
                  <th className="table-header">Variant</th>
                  <th className="table-header text-right">Qty Sold</th>
                  <th className="table-header text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(productData || []).map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{p.product_name}</td>
                    <td className="table-cell text-gray-500">{p.variant_name || '—'}</td>
                    <td className="table-cell text-right">{p.total_qty}</td>
                    <td className="table-cell text-right font-bold text-brand-600">{formatCurrency(p.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payments */}
      {activeReport === 'payments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Payment Mode Breakdown</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={paymentData || []} dataKey="total" nameKey="mode" cx="50%" cy="50%" outerRadius={90}>
                  {(paymentData || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip formatter={v => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">By Amount</h3>
            <div className="space-y-3">
              {(paymentData || []).map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium capitalize">{p.mode}</span>
                      <span className="text-sm font-bold">{formatCurrency(p.total)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${(p.total / (paymentData || []).reduce((s, x) => s + x.total, 0) * 100).toFixed(1)}%`,
                          backgroundColor: COLORS[i % COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Profit & Loss */}
      {activeReport === 'profit' && plData && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card border-l-4 border-brand-500">
              <p className="text-sm text-gray-500">Gross Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(plData.gross_revenue)}</p>
              <p className="text-xs text-gray-400">{plData.total_discount > 0 ? `Disc: ${formatCurrency(plData.total_discount)}` : 'No discounts'}</p>
            </div>
            <div className="stat-card border-l-4 border-amber-500">
              <p className="text-sm text-gray-500">Stock Purchases</p>
              <p className="text-2xl font-bold text-amber-700">{formatCurrency(plData.total_purchases)}</p>
              <p className="text-xs text-gray-400">Cost of goods</p>
            </div>
            <div className="stat-card border-l-4 border-red-400">
              <p className="text-sm text-gray-500">Operating Expenses</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(plData.total_expenses)}</p>
              <p className="text-xs text-gray-400">Rent, salaries, etc.</p>
            </div>
            <div className={`stat-card border-l-4 ${plData.net_profit >= 0 ? 'border-green-500' : 'border-red-600'}`}>
              <p className="text-sm text-gray-500">Net Profit</p>
              <p className={`text-2xl font-bold ${plData.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(plData.net_profit)}
              </p>
              <p className="text-xs text-gray-400">Margin: {plData.profit_margin?.toFixed(1)}%</p>
            </div>
          </div>

          {/* P&L Waterfall */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Income Statement</h3>
            <div className="space-y-0 text-sm">
              <PLRow label="Sales Revenue" amount={plData.gross_revenue} />
              <PLRow label="Less: Tax Collected" amount={-plData.tax_collected} isDeduct />
              <PLDivider />
              <PLRow label="Net Sales Revenue" amount={plData.net_revenue} bold />
              <PLRow label="Less: Stock Purchases (COGS)" amount={-plData.total_purchases} isDeduct />
              <PLDivider />
              <PLRow label="Gross Profit" amount={plData.gross_profit} bold colored />
              <PLRow label="Less: Operating Expenses" amount={-plData.total_expenses} isDeduct />
              <PLDivider />
              <PLRow label="Net Profit / (Loss)" amount={plData.net_profit} bold large colored />
            </div>
          </div>

          {/* Side by side: expense breakdown + purchases info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plData.expense_breakdown?.length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">Expenses by Category</h3>
                <div className="space-y-2">
                  {plData.expense_breakdown.map((e, i) => {
                    const pct = plData.total_expenses > 0 ? (e.amount / plData.total_expenses * 100) : 0
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-0.5">
                          <span className="capitalize text-gray-700">{e.category}</span>
                          <span className="font-medium">{formatCurrency(e.amount)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${pct.toFixed(1)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Revenue per ₹1 of purchases</span>
                  <span className="font-medium">
                    {plData.total_purchases > 0 ? `₹${(plData.gross_revenue / plData.total_purchases).toFixed(2)}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Gross margin</span>
                  <span className="font-medium">
                    {plData.net_revenue > 0 ? `${(plData.gross_profit / plData.net_revenue * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Expense ratio</span>
                  <span className="font-medium">
                    {plData.net_revenue > 0 ? `${(plData.total_expenses / plData.net_revenue * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax collected (to remit)</span>
                  <span className="font-medium text-amber-600">{formatCurrency(plData.tax_collected)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
