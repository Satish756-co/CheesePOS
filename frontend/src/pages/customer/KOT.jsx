import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { kotAPI, outletsAPI } from '@/api'
import { formatDateTime } from '@/utils/formatters'
import toast from 'react-hot-toast'
import { ChefHat, Clock, CheckCircle, XCircle } from 'lucide-react'

const STATUS_STYLES = {
  new: 'border-blue-400 bg-blue-50',
  accepted: 'border-orange-400 bg-orange-50',
  preparing: 'border-yellow-400 bg-yellow-50',
  ready: 'border-green-400 bg-green-50',
}

const NEXT_STATUS = {
  new: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'served',
}

const NEXT_LABEL = {
  new: 'Accept',
  accepted: 'Start Cooking',
  preparing: 'Mark Ready',
  ready: 'Mark Served',
}

export default function KOT() {
  const qc = useQueryClient()
  const [selectedOutlet, setSelectedOutlet] = useState(null)
  const [station, setStation] = useState('kitchen')

  const { data: outlets } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletsAPI.list().then(r => r.data),
  })

  useEffect(() => {
    if (outlets && outlets.length > 0 && !selectedOutlet) setSelectedOutlet(outlets[0].id)
  }, [outlets])

  const { data: kots, isLoading } = useQuery({
    queryKey: ['kots', selectedOutlet, station],
    queryFn: () => kotAPI.list({ outlet_id: selectedOutlet, station }).then(r => r.data),
    enabled: !!selectedOutlet,
    refetchInterval: 15000,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => kotAPI.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kots'] })
      toast.success('Status updated')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  })

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ChefHat className="text-brand-500" />
            Kitchen Display / KOT
          </h1>
          <p className="text-sm text-gray-500">Live kitchen orders</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
            {['kitchen', 'bar'].map(s => (
              <button key={s} onClick={() => setStation(s)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors
                  ${station === s ? 'bg-brand-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                {s}
              </button>
            ))}
          </div>
          {outlets && outlets.length > 1 && (
            <select className="input w-40" value={selectedOutlet || ''} onChange={e => setSelectedOutlet(parseInt(e.target.value))}>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {(kots || []).map(kot => (
          <div key={kot.id} className={`border-2 rounded-xl p-4 ${STATUS_STYLES[kot.status] || 'border-gray-300 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-gray-900">{kot.kot_number}</p>
                {kot.table_id && <p className="text-sm text-gray-500">Table #{kot.table_id}</p>}
              </div>
              <div className="flex items-center gap-1 text-gray-500 text-xs">
                <Clock size={12} />
                <span>{formatDateTime(kot.created_at)}</span>
              </div>
            </div>

            <div className="space-y-1.5 mb-4">
              {(kot.items || []).map(item => (
                <div key={item.id} className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-bold text-gray-900 text-sm">{item.product_name}</span>
                    {item.variant_name && <span className="text-xs text-gray-500 ml-1">({item.variant_name})</span>}
                    {item.special_instructions && (
                      <p className="text-xs text-orange-600 mt-0.5">⚠️ {item.special_instructions}</p>
                    )}
                  </div>
                  <span className="font-bold text-lg text-gray-900">{item.quantity}</span>
                </div>
              ))}
            </div>

            {kot.notes && (
              <p className="text-xs text-gray-600 bg-white/70 rounded-lg px-3 py-2 mb-3 italic">
                Note: {kot.notes}
              </p>
            )}

            {NEXT_STATUS[kot.status] && (
              <button
                onClick={() => updateStatus.mutate({ id: kot.id, status: NEXT_STATUS[kot.status] })}
                disabled={updateStatus.isPending}
                className="w-full btn-primary py-2 text-sm"
              >
                {NEXT_LABEL[kot.status]}
              </button>
            )}
          </div>
        ))}
      </div>

      {(!kots || kots.length === 0) && !isLoading && (
        <div className="text-center py-16 text-gray-400">
          <ChefHat size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No active orders</p>
          <p className="text-sm mt-1">New orders will appear here automatically</p>
        </div>
      )}
    </div>
  )
}
