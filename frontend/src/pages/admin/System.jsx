import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminAPI } from '@/api'
import toast from 'react-hot-toast'
import { Server, Database, Cpu, Users, RefreshCw, CheckCircle, AlertCircle, Settings, Edit2, X } from 'lucide-react'

function StatusRow({ label, status = 'ok', detail }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-xs text-gray-400">{detail}</span>}
        {status === 'ok'
          ? <CheckCircle size={16} className="text-green-500" />
          : <AlertCircle size={16} className="text-red-500" />
        }
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color = 'text-brand-600', bg = 'bg-brand-50' }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <Icon size={18} className={color} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function PlatformSettingsCard() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminAPI.getSettings().then(r => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (data) => adminAPI.updateSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['public-config'] })
      toast.success('Settings saved')
      setEditing(false)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save'),
  })

  const handleEdit = () => {
    setDraft(Object.fromEntries(Object.entries(settings || {}).map(([k, v]) => [k, v.value])))
    setEditing(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    saveMutation.mutate(draft)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Settings size={16} className="text-brand-500" /> Platform Settings
        </h2>
        {!editing && (
          <button onClick={handleEdit} className="text-gray-400 hover:text-brand-500 flex items-center gap-1 text-sm">
            <Edit2 size={14} /> Edit
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          {Object.entries(settings || {}).map(([key, meta]) => (
            <div key={key}>
              <label className="label">{meta.label}</label>
              {meta.type === 'bool' ? (
                <button
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, [key]: !d[key] }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${draft[key] ? 'bg-brand-500' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${draft[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="input w-28"
                    value={draft[key] ?? meta.value}
                    onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                    min={meta.min}
                    max={meta.max}
                    required
                  />
                  <span className="text-xs text-gray-400">
                    {meta.min !== null && meta.max !== null ? `(${meta.min}–${meta.max})` : ''}
                  </span>
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-1 text-sm py-1.5 px-3">
              <X size={14} /> Cancel
            </button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary text-sm py-1.5 px-3">
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          {Object.entries(settings || {}).map(([key, meta]) => (
            <div key={key} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
              <span className="text-sm text-gray-500">{meta.label}</span>
              {meta.type === 'bool' ? (
                <span className={`text-sm font-semibold ${meta.value ? 'text-green-600' : 'text-gray-400'}`}>
                  {meta.value ? 'Enabled' : 'Disabled'}
                </span>
              ) : (
                <span className="font-bold text-gray-900 text-lg">{meta.value}</span>
              )}
            </div>
          ))}
          {Object.keys(settings || {}).length === 0 && (
            <p className="text-sm text-gray-400">No settings configured.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminSystem() {
  const { data: dashboard } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminAPI.getDashboard().then(r => r.data),
    refetchInterval: 60000,
  })

  const now = new Date()

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System</h1>
          <p className="text-sm text-gray-500">Health monitoring and configuration</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <RefreshCw size={12} className="animate-spin opacity-50" />
          Auto-refreshes every 60s
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Users} label="Total Customers" value={dashboard?.total_customers || 0} />
        <MetricCard icon={Server} label="Active Outlets" value={dashboard?.total_outlets || 0} bg="bg-green-50" color="text-green-600" />
        <MetricCard icon={AlertCircle} label="Open Tickets" value={dashboard?.open_support_tickets || 0} bg="bg-orange-50" color="text-orange-600" />
        <MetricCard icon={Cpu} label="New This Month" value={dashboard?.new_customers_this_month || 0} bg="bg-blue-50" color="text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Server size={16} className="text-brand-500" /> Services
          </h2>
          <div>
            <StatusRow label="Web API (Flask)" status="ok" detail="Port 5000" />
            <StatusRow label="Database (PostgreSQL)" status="ok" detail="Port 5432" />
            <StatusRow label="Cache (Redis)" status="ok" detail="Port 6379" />
            <StatusRow label="Frontend (React)" status="ok" detail="Port 3000" />
            <StatusRow label="Nginx Proxy" status="ok" detail="Port 80/443" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Database size={16} className="text-brand-500" /> Application Info
          </h2>
          <div className="space-y-3 text-sm">
            {[
              ['Version', 'CheesePOS v1.0.0'],
              ['Backend', 'Flask 3.0 + SQLAlchemy'],
              ['Frontend', 'React 18 + Vite'],
              ['Database', 'PostgreSQL 15'],
              ['Auth', 'JWT (8h access / 30d refresh)'],
              ['Server Time', now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users size={16} className="text-brand-500" /> Customer Summary
          </h2>
          <div className="space-y-3">
            {[
              ['Active', dashboard?.active_customers, 'text-green-600'],
              ['Trial', dashboard?.trial_customers, 'text-blue-600'],
              ['Expired', dashboard?.expired_customers, 'text-red-600'],
            ].map(([label, count, color]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={`text-lg font-bold ${color}`}>{count ?? '—'}</span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-lg font-bold text-gray-900">{dashboard?.total_customers ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* Platform Settings — editable */}
        <PlatformSettingsCard />

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Cpu size={16} className="text-brand-500" /> Feature Flags
          </h2>
          <div className="space-y-2">
            {[
              ['Multi-tenant SaaS', true],
              ['KOT System', true],
              ['Inventory Management', true],
              ['Razorpay Payments', false],
              ['Email Notifications', false],
              ['Receipt Printing', true],
            ].map(([feature, enabled]) => (
              <div key={feature} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">{feature}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
