import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminAPI } from '@/api'
import { formatDate, getStatusColor } from '@/utils/formatters'
import { Search, Eye, Plus, Trash2, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'expired', label: 'Expired' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pending_deletion', label: 'Pending Deletion' },
]

function daysRemaining(expiresAt) {
  if (!expiresAt) return null
  const ms = new Date(expiresAt) - new Date()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

function CreateCustomerModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    business_name: '', owner_name: '', email: '', phone: '',
    first_name: '', last_name: '', city: '', state: '',
  })
  const [err, setErr] = useState('')

  const mutation = useMutation({
    mutationFn: (data) => adminAPI.createTenant(data),
    onSuccess: () => {
      toast.success('Customer created and welcome email sent')
      onSuccess()
    },
    onError: (e) => setErr(e?.response?.data?.error || 'Failed to create customer'),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    setErr('')
    if (!form.business_name || !form.first_name || !form.last_name || !form.email || !form.phone) {
      return setErr('Business name, owner details, email and phone are required')
    }
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Create New Customer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Business Name *</label>
            <input className="input w-full" value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="e.g. The Grand Bar" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
              <input className="input w-full" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="John" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
              <input className="input w-full" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
            <input className="input w-full" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="owner@business.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
            <input className="input w-full" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
              <input className="input w-full" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Mumbai" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
              <input className="input w-full" value={form.state} onChange={e => set('state', e.target.value)} placeholder="Maharashtra" />
            </div>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 btn-primary disabled:opacity-50">
              {mutation.isPending ? 'Creating…' : 'Create & Send Welcome Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ tenant, onClose, onSuccess }) {
  const mutation = useMutation({
    mutationFn: () => adminAPI.deleteTenant(tenant.id),
    onSuccess: () => {
      toast.success(`${tenant.business_name} moved to pending deletion`)
      onSuccess()
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to delete'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Customer?</h2>
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-medium">{tenant.business_name}</span> will be deactivated and their login will be blocked.
        </p>
        <p className="text-sm text-gray-500 mb-5">
          Data is kept for 14 days. You can reactivate during this period. After 14 days, all data is permanently deleted.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {mutation.isPending ? 'Deleting…' : 'Delete & Start 14-day Cooldown'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminTenants() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tenants', search, status, page],
    queryFn: () => adminAPI.listTenants({ search, status, page, per_page: 20 }).then(r => r.data),
  })

  const updateTenant = useMutation({
    mutationFn: ({ id, data }) => adminAPI.updateTenant(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tenants'] }); toast.success('Updated') },
  })

  const reactivate = useMutation({
    mutationFn: (id) => adminAPI.reactivateTenant(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tenants'] }); toast.success('Customer reactivated') },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to reactivate'),
  })

  const handleCreated = () => {
    setShowCreate(false)
    qc.invalidateQueries({ queryKey: ['admin-tenants'] })
  }

  const handleDeleted = () => {
    setDeleteTarget(null)
    qc.invalidateQueries({ queryKey: ['admin-tenants'] })
  }

  return (
    <div className="p-6">
      {showCreate && <CreateCustomerModal onClose={() => setShowCreate(false)} onSuccess={handleCreated} />}
      {deleteTarget && <DeleteConfirmModal tenant={deleteTarget} onClose={() => setDeleteTarget(null)} onSuccess={handleDeleted} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">{data?.total || 0} registered businesses</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Create Customer
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name, email, city..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="flex bg-white rounded-lg border border-gray-200 p-0.5 flex-wrap">
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => { setStatus(s.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors
                ${status === s.value ? 'bg-slate-800 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Business</th>
              <th className="table-header">Contact</th>
              <th className="table-header">Location</th>
              <th className="table-header">Plan</th>
              <th className="table-header">Status</th>
              <th className="table-header">Joined</th>
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-8">Loading…</td></tr>
            )}
            {!isLoading && (data?.tenants || []).length === 0 && (
              <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-8">No customers found</td></tr>
            )}
            {(data?.tenants || []).map(t => {
              const isPendingDeletion = t.deletion_status === 'pending_deletion'
              const days = isPendingDeletion ? daysRemaining(t.deletion_expires_at) : null

              return (
                <tr key={t.id} className={`hover:bg-gray-50 ${isPendingDeletion ? 'bg-red-50/40' : ''}`}>
                  <td className="table-cell">
                    <div>
                      <p className="font-medium text-gray-900">{t.business_name}</p>
                      <p className="text-xs text-gray-400">{t.tenant_code}</p>
                    </div>
                  </td>
                  <td className="table-cell">
                    <p className="text-sm">{t.owner_name}</p>
                    <p className="text-xs text-gray-400">{t.email}</p>
                  </td>
                  <td className="table-cell text-gray-600">{[t.city, t.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="table-cell text-gray-600">
                    {t.subscription?.plan?.name || '—'}
                  </td>
                  <td className="table-cell">
                    {isPendingDeletion ? (
                      <div>
                        <span className="badge bg-red-100 text-red-700">Pending Deletion</span>
                        {days !== null && (
                          <p className="text-xs text-red-500 mt-0.5">
                            {days === 0 ? 'Expires today' : `${days}d remaining`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className={`badge ${getStatusColor(t.status)}`}>{t.status}</span>
                    )}
                  </td>
                  <td className="table-cell text-gray-500 text-xs">{formatDate(t.created_at)}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/admin/tenants/${t.id}`)} className="text-slate-600 hover:text-slate-900" title="View details">
                        <Eye size={16} />
                      </button>
                      {isPendingDeletion ? (
                        <button
                          onClick={() => reactivate.mutate(t.id)}
                          disabled={reactivate.isPending}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                          title="Reactivate customer"
                        >
                          <RotateCcw size={13} />
                          Reactivate
                        </button>
                      ) : (
                        <>
                          {t.status === 'trial' && (
                            <button
                              onClick={() => updateTenant.mutate({ id: t.id, data: { status: 'active' } })}
                              className="text-xs text-green-600 hover:text-green-700 font-medium"
                            >
                              Activate
                            </button>
                          )}
                          {t.status === 'active' && (
                            <button
                              onClick={() => updateTenant.mutate({ id: t.id, data: { status: 'suspended' } })}
                              className="text-xs text-orange-500 hover:text-orange-700 font-medium"
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(t)}
                            className="text-red-400 hover:text-red-600"
                            title="Delete customer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {data?.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium ${page === p ? 'bg-slate-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
