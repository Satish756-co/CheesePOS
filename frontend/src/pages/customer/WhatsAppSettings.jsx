import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { whatsappAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Smartphone, CheckCircle, WifiOff, RefreshCw, Loader, Lock } from 'lucide-react'

const STATUS_POLL = {
  connected:      30_000,
  qr_ready:        3_000,
  initializing:    3_000,
  authenticated:   3_000,
  loading:         3_000,
  not_connected:  null,
  error:          null,
}

export default function WhatsAppSettings() {
  const qc = useQueryClient()
  const { tenant, user } = useAuthStore()

  if (!tenant?.whatsapp_enabled || !['owner', 'admin'].includes(user?.role)) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Lock size={22} className="text-gray-400" />
          </div>
          <p className="font-semibold text-gray-700">WhatsApp Not Available</p>
          <p className="text-sm text-gray-400 mt-1">This feature has not been enabled for your account. Contact support to get it activated.</p>
        </div>
      </div>
    )
  }

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => whatsappAPI.getStatus().then(r => r.data),
    refetchInterval: (query) => STATUS_POLL[query.state.data?.status] ?? 10_000,
  })

  const connect = useMutation({
    mutationFn: () => whatsappAPI.connect(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp-status'] }),
    onError: () => toast.error('Could not reach WhatsApp service'),
  })

  const disconnect = useMutation({
    mutationFn: () => whatsappAPI.disconnect(),
    onSuccess: () => {
      toast.success('WhatsApp disconnected')
      qc.invalidateQueries({ queryKey: ['whatsapp-status'] })
    },
  })

  const status = data?.status || 'not_connected'
  const isConnected = status === 'connected'
  const isWaiting = ['initializing', 'loading', 'authenticated'].includes(status)
  const isQR = status === 'qr_ready'

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
          <Smartphone size={20} className="text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">WhatsApp Integration</h1>
          <p className="text-sm text-gray-500">Auto-send bills to customers after payment</p>
        </div>
      </div>

      {/* Status card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">

        {/* Status indicator */}
        <div className="flex items-center gap-2 mb-5">
          {isConnected ? (
            <><CheckCircle size={18} className="text-green-500" /><span className="font-semibold text-green-700">Connected</span></>
          ) : isQR ? (
            <><Loader size={18} className="text-orange-500 animate-spin" /><span className="font-semibold text-orange-600">Waiting for scan…</span></>
          ) : isWaiting ? (
            <><Loader size={18} className="text-blue-500 animate-spin" /><span className="font-semibold text-blue-600">Connecting…</span></>
          ) : (
            <><WifiOff size={18} className="text-gray-400" /><span className="font-semibold text-gray-500">Not connected</span></>
          )}
        </div>

        {/* QR code */}
        {isQR && data?.qr && (
          <div className="text-center mb-5 p-4 bg-gray-50 rounded-xl">
            <img src={data.qr} alt="WhatsApp QR Code" className="mx-auto w-52 h-52 rounded-lg border border-gray-200" />
            <p className="text-sm text-gray-500 mt-3">
              Open WhatsApp → <strong>Linked Devices</strong> → <strong>Link a Device</strong> → Scan this QR
            </p>
          </div>
        )}

        {/* Connected benefits */}
        {isConnected && (
          <div className="bg-green-50 rounded-xl p-4 mb-5 space-y-2 text-sm text-green-800">
            <p>✅ Bills automatically sent after every payment</p>
            <p>✅ Customer receives bill on their WhatsApp instantly</p>
            <p>✅ Messages sent from your business WhatsApp number</p>
          </div>
        )}

        {/* Not connected info */}
        {!isConnected && !isQR && !isWaiting && (
          <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm text-gray-600 space-y-1">
            <p>Connect your WhatsApp number to automatically send bills after every payment.</p>
            <p className="text-gray-400 mt-2">You will need to scan a QR code once from your phone.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!isConnected && !isQR && !isWaiting && (
            <button
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Smartphone size={16} />
              Connect WhatsApp
            </button>
          )}
          {(isQR || isWaiting) && (
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['whatsapp-status'] })}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          )}
          {(isConnected || isQR || isWaiting) && (
            <button
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="text-sm px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-medium"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <p className="font-semibold text-gray-800 mb-4">How it works</p>
        <div className="space-y-4">
          {[
            ['1', 'Connect your number', 'Scan the QR code once with your WhatsApp. Session stays active — no need to scan again.'],
            ['2', 'Staff creates a bill', 'When a customer\'s phone number is entered during billing, the bill is sent automatically after payment.'],
            ['3', 'Customer gets the bill', 'They receive a WhatsApp message from your number with the full bill details instantly.'],
          ].map(([step, title, desc]) => (
            <div key={step} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                {step}
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
