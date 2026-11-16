import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { outletsAPI, ordersAPI } from '@/api'
import { useUserOutlets } from '@/hooks/useUserOutlets'
import { TABLE_STATUS_COLORS } from '@/utils/formatters'
import toast from 'react-hot-toast'
import { Users, X, ShoppingBag, Clock, ChevronRight } from 'lucide-react'

const TABLE_STATUSES = ['available', 'occupied', 'order_placed', 'preparing', 'ready', 'billed', 'reserved']

export default function Tables() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { outlets, defaultOutletId } = useUserOutlets()
  const [selectedOutlet, setSelectedOutlet] = useState(null)
  const [selectedTable, setSelectedTable] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => {
    if (defaultOutletId && !selectedOutlet) setSelectedOutlet(defaultOutletId)
  }, [defaultOutletId, selectedOutlet])

  const { data: tables } = useQuery({
    queryKey: ['tables', selectedOutlet],
    queryFn: () => outletsAPI.getTables(selectedOutlet).then(r => r.data),
    enabled: !!selectedOutlet,
    refetchInterval: 15000,
    staleTime: 0,
  })

  // Use live data from the refreshing tables array, not the stale click-time snapshot
  const liveStatus = tables?.find(t => t.id === selectedTable?.id)?.status ?? selectedTable?.status

  const { data: activeOrders, isLoading: loadingOrder } = useQuery({
    queryKey: ['table-active-order', selectedTable?.id],
    queryFn: () => ordersAPI.list({ table_id: selectedTable.id, active_only: '1', outlet_id: selectedOutlet }).then(r => r.data),
    enabled: !!selectedTable && liveStatus !== 'available',
    refetchInterval: 10000,
  })
  const activeOrder = activeOrders?.[0] || null

  const cancelOrder = useMutation({
    mutationFn: (orderId) => ordersAPI.updateStatus(orderId, 'cancelled'),
    onSuccess: () => {
      toast.success('Order cancelled, table freed')
      qc.invalidateQueries({ queryKey: ['tables', selectedOutlet] })
      qc.invalidateQueries({ queryKey: ['table-active-order', selectedTable?.id] })
      qc.invalidateQueries({ queryKey: ['stock-quick'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      setSelectedTable(null)
      setConfirmCancel(false)
    },
    onError: () => toast.error('Failed to cancel order'),
  })

  const sections = [...new Set((tables || []).map(t => t.floor_section))]
  const currentTableData = tables?.find(t => t.id === selectedTable?.id) || selectedTable

  return (
    <div className="p-4 md:p-6 flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Table Management</h1>
            <p className="text-sm text-gray-500">Manage seating and orders</p>
          </div>
          {outlets && outlets.length > 1 && (
            <select className="input w-44" value={selectedOutlet || ''} onChange={e => setSelectedOutlet(parseInt(e.target.value))}>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>

        <div className="flex gap-3 mb-6 flex-wrap">
          {TABLE_STATUSES.map(status => (
            <div key={status} className={`px-3 py-1 rounded-full text-xs border ${TABLE_STATUS_COLORS[status] || 'bg-gray-100 border-gray-300'}`}>
              {status.replace('_', ' ').toUpperCase()}
            </div>
          ))}
        </div>

        {sections.map(section => (
          <div key={section} className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">{section}</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-3">
              {(tables || []).filter(t => t.floor_section === section).map(table => (
                <div
                  key={table.id}
                  className={`border-2 rounded-xl p-3 cursor-pointer transition-all ${TABLE_STATUS_COLORS[table.status] || 'bg-gray-100 border-gray-300'} ${selectedTable?.id === table.id ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                  onClick={() => { setSelectedTable(table); setConfirmCancel(false); qc.invalidateQueries({ queryKey: ['tables', selectedOutlet] }) }}
                >
                  <p className="font-bold text-center text-lg">{table.table_number}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Users size={10} />
                    <span className="text-xs">{table.seating_capacity}</span>
                  </div>
                  <p className="text-xs text-center mt-1 capitalize">{table.status.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {(!tables || tables.length === 0) && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🪑</p>
            <p className="font-medium">No tables configured</p>
            <p className="text-sm mt-1">Go to Outlets → Tables to add tables</p>
          </div>
        )}
      </div>

      {selectedTable && (
        <div className="lg:w-72 flex-shrink-0">
          <div className="bg-white border rounded-xl p-5 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Table {currentTableData?.table_number}</h2>
              <button onClick={() => { setSelectedTable(null); setConfirmCancel(false) }} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 mb-5 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Section</span>
                <span className="font-medium">{currentTableData?.floor_section}</span>
              </div>
              <div className="flex justify-between">
                <span>Capacity</span>
                <span className="font-medium">{currentTableData?.seating_capacity} seats</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs border font-medium capitalize ${TABLE_STATUS_COLORS[currentTableData?.status] || 'bg-gray-100'}`}>
                  {currentTableData?.status?.replace('_', ' ')}
                </span>
              </div>
            </div>

            {liveStatus === 'available' ? (
              <button
                className="w-full btn btn-primary flex items-center justify-center gap-2"
                onClick={() => navigate('/app/table-billing')}
              >
                <ShoppingBag size={16} />
                Start New Order
              </button>
            ) : (
              <div className="space-y-3">
                {loadingOrder ? (
                  <div className="text-center text-sm text-gray-400 py-3">Loading order...</div>
                ) : activeOrder ? (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-gray-800">{activeOrder.order_number}</span>
                      <span className="text-gray-500 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(activeOrder.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>{activeOrder.items?.length ?? 0} items</span>
                      <span className="font-semibold">₹{Number(activeOrder.total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                ) : null}

                <button
                  className="w-full btn btn-primary flex items-center justify-center gap-2"
                  onClick={() => navigate('/app/table-billing')}
                >
                  <ShoppingBag size={16} />
                  Go to Billing
                  <ChevronRight size={14} />
                </button>

                {!confirmCancel ? (
                  <button
                    className="w-full text-sm py-2 px-4 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancel Order &amp; Free Table
                  </button>
                ) : (
                  <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                    <p className="text-xs text-red-700 mb-3 text-center font-medium">Cancel this order and free the table?</p>
                    <div className="flex gap-2">
                      <button
                        className="flex-1 text-xs py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50"
                        onClick={() => setConfirmCancel(false)}
                      >
                        Keep
                      </button>
                      <button
                        className="flex-1 text-xs py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        onClick={() => activeOrder && cancelOrder.mutate(activeOrder.id)}
                        disabled={!activeOrder || cancelOrder.isPending}
                      >
                        {cancelOrder.isPending ? 'Cancelling...' : 'Yes, Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
