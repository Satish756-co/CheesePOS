import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventoryAPI } from '@/api'
import { useUserOutlets } from '@/hooks/useUserOutlets'
import { formatCurrency, formatNumber } from '@/utils/formatters'
import { exportToExcel, INVENTORY_COLUMNS } from '@/utils/exportExcel'
import { useAuthStore } from '@/store/authStore'
import { Search, AlertTriangle, Package, ArrowRightLeft, Download } from 'lucide-react'

export default function Inventory() {
  const canExport = useAuthStore(s => s.hasAction('reports.export'))
  const { outlets, defaultOutletId } = useUserOutlets()
  const [selectedOutlet, setSelectedOutlet] = useState(null)
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  useEffect(() => {
    if (defaultOutletId && !selectedOutlet) setSelectedOutlet(defaultOutletId)
  }, [defaultOutletId, selectedOutlet])

  const { data: stockData } = useQuery({
    queryKey: ['stock', selectedOutlet, search, lowStockOnly],
    queryFn: () => inventoryAPI.getCurrentStock({ outlet_id: selectedOutlet, search, low_stock_only: lowStockOnly }).then(r => r.data),
    enabled: !!selectedOutlet,
  })

  const stock = stockData?.stock || []
  const lowStockCount = stock.filter(s => s.is_low_stock).length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">{stockData?.total || 0} items tracked</p>
        </div>
        {canExport && (
          <button onClick={() => exportToExcel(stock, INVENTORY_COLUMNS, 'inventory')} className="btn-secondary flex items-center gap-2">
            <Download size={16} /> Export Excel
          </button>
        )}
      </div>

      {lowStockCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-orange-500 flex-shrink-0" />
          <p className="text-orange-700 text-sm font-medium">
            {lowStockCount} item{lowStockCount > 1 ? 's' : ''} running low on stock
          </p>
          <button onClick={() => setLowStockOnly(true)} className="ml-auto text-xs text-orange-600 underline">
            View only
          </button>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {outlets && outlets.length > 1 && (
          <select className="input w-44" value={selectedOutlet || ''} onChange={e => setSelectedOutlet(parseInt(e.target.value))}>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <button
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
            ${lowStockOnly ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}
        >
          Low Stock
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Product</th>
              <th className="table-header">Category</th>
              <th className="table-header">Variant</th>
              <th className="table-header text-right">Current Stock</th>
              <th className="table-header text-right">Avg Cost</th>
              <th className="table-header text-right">Stock Value</th>
              <th className="table-header">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stock.map((s, i) => (
              <tr key={i} className={`hover:bg-gray-50 ${s.is_low_stock ? 'bg-orange-50/50' : ''}`}>
                <td className="table-cell font-medium">{s.product_name}</td>
                <td className="table-cell text-gray-500">{s.category}</td>
                <td className="table-cell text-gray-500">{s.variant_name || '—'}</td>
                <td className="table-cell text-right">
                  <span className={`font-bold ${s.is_low_stock ? 'text-orange-600' : 'text-gray-900'}`}>
                    {formatNumber(s.current_stock)}
                  </span>
                </td>
                <td className="table-cell text-right text-gray-600">{formatCurrency(s.avg_cost)}</td>
                <td className="table-cell text-right font-medium">
                  {formatCurrency(s.current_stock * s.avg_cost)}
                </td>
                <td className="table-cell">
                  {s.is_low_stock ? (
                    <span className="badge badge-yellow flex items-center gap-1">
                      <AlertTriangle size={10} /> Low
                    </span>
                  ) : (
                    <span className="badge badge-green">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stock.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>No inventory records. Add purchases to track stock.</p>
          </div>
        )}
      </div>
    </div>
  )
}
