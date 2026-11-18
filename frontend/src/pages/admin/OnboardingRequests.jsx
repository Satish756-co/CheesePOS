import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminAPI } from '@/api'
import toast from 'react-hot-toast'
import { Clock, CheckCircle, XCircle, Building2, Mail, Phone, Calendar, ChevronDown, ChevronUp } from 'lucide-react'

const STATUS_COLORS = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const STATUS_ICONS = {
  pending:  <Clock size={14} />,
  approved: <CheckCircle size={14} />,
  rejected: <XCircle size={14} />,
}

const BUSINESS_TYPES = [
  { value: 'bar_restaurant', label: 'Bar & Restaurant' },
  { value: 'saloon',         label: 'Saloon / Spa' },
  { value: 'daily_store',    label: 'Daily Store / Kirana' },
  { value: 'scanning_lab',   label: 'Scanning Center / Lab' },
  { value: 'pharmacy',       label: 'Pharmacy' },
  { value: 'retail_shop',    label: 'Retail Shop' },
  { value: 'hr_operations',  label: 'HR Operations' },
  { value: 'other',          label: 'Other' },
]

function RejectModal({ request, onClose, onReject }) {
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      await onReject(request.id, { reason, notify })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Request</h3>
        <p className="text-sm text-gray-500 mb-4">
          Rejecting request from <strong>{request.business_name}</strong> ({request.email})
        </p>
        <div className="space-y-3">
          <div>
            <label className="label">Reason (optional)</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Briefly explain why the request is being rejected..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={notify}
              onChange={e => setNotify(e.target.checked)}
              className="rounded"
            />
            Send rejection email to applicant
          </label>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex-1 disabled:opacity-50"
          >
            {loading ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ApproveModal({ request, onClose, onApprove }) {
  const [form, setForm] = useState({
    business_name: request.business_name,
    email: request.email,
    owner_name: request.owner_name || '',
    phone: request.phone,
    business_type: request.business_type || 'bar_restaurant',
    city: '',
    state: '',
  })
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    setLoading(true)
    try {
      await onApprove(request.id, form)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Approve & Create Account</h3>
        <p className="text-sm text-gray-500 mb-4">Review and confirm the tenant details before creating the account.</p>
        <div className="space-y-3">
          <div>
            <label className="label">Business Name</label>
            <input className="input" value={form.business_name} onChange={e => set('business_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Business Type</label>
            <select className="input" value={form.business_type} onChange={e => set('business_type', e.target.value)}>
              {BUSINESS_TYPES.map(bt => (
                <option key={bt.value} value={bt.value}>{bt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Owner Name</label>
            <input className="input" value={form.owner_name} onChange={e => set('owner_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input" value={form.state} onChange={e => set('state', e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 bg-blue-50 p-3 rounded-lg">
          If this email already has a CheesePOS account, the new business will be linked to it — no password reset needed. Otherwise, a welcome email with login credentials is sent.
        </p>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? 'Creating...' : 'Approve & Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RequestCard({ request, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(x => !x)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">{request.business_name}</h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[request.status]}`}>
              {STATUS_ICONS[request.status]}
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              {request.business_type_label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500 flex-wrap">
            <span className="flex items-center gap-1"><Mail size={13} />{request.email}</span>
            <span className="flex items-center gap-1"><Phone size={13} />{request.phone}</span>
            <span className="flex items-center gap-1"><Calendar size={13} />
              {new Date(request.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {request.status === 'pending' && (
            <>
              <button
                onClick={e => { e.stopPropagation(); onApprove(request) }}
                className="btn-primary text-xs px-3 py-1.5"
              >
                Approve
              </button>
              <button
                onClick={e => { e.stopPropagation(); onReject(request) }}
                className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs px-3 py-1.5 rounded-lg font-medium"
              >
                Reject
              </button>
            </>
          )}
          {expanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 text-sm">
          {request.owner_name && (
            <p className="text-gray-600 mb-1"><span className="font-medium text-gray-700">Owner:</span> {request.owner_name}</p>
          )}
          {request.description && (
            <p className="text-gray-600 mb-1"><span className="font-medium text-gray-700">Message:</span> {request.description}</p>
          )}
          {request.status === 'rejected' && request.rejection_reason && (
            <p className="text-red-600 mb-1"><span className="font-medium">Rejection reason:</span> {request.rejection_reason}</p>
          )}
          {request.status === 'approved' && request.tenant_id && (
            <p className="text-green-600"><span className="font-medium">Tenant ID:</span> {request.tenant_id}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function OnboardingRequests() {
  const [statusFilter, setStatusFilter] = useState('pending')
  const [approvingRequest, setApprovingRequest] = useState(null)
  const [rejectingRequest, setRejectingRequest] = useState(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-onboarding-requests', statusFilter],
    queryFn: () => adminAPI.listOnboardingRequests({ status: statusFilter || undefined }),
    select: r => r.data,
  })

  const { data: pendingData } = useQuery({
    queryKey: ['admin-onboarding-pending-count'],
    queryFn: () => adminAPI.listOnboardingRequests({ status: 'pending', per_page: 1 }),
    select: r => r.data?.pending_count ?? 0,
    refetchInterval: 60000,
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, data: d }) => adminAPI.approveOnboardingRequest(id, d),
    onSuccess: () => {
      toast.success('Account created and welcome email sent!')
      qc.invalidateQueries({ queryKey: ['admin-onboarding-requests'] })
      qc.invalidateQueries({ queryKey: ['admin-onboarding-pending-count'] })
      qc.invalidateQueries({ queryKey: ['admin-tenants'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Approval failed'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, data: d }) => adminAPI.rejectOnboardingRequest(id, d),
    onSuccess: () => {
      toast.success('Request rejected')
      qc.invalidateQueries({ queryKey: ['admin-onboarding-requests'] })
      qc.invalidateQueries({ queryKey: ['admin-onboarding-pending-count'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Rejection failed'),
  })

  const handleApprove = async (id, formData) => {
    await approveMutation.mutateAsync({ id, data: formData })
  }

  const handleReject = async (id, rejectData) => {
    await rejectMutation.mutateAsync({ id, data: rejectData })
  }

  const requests = data?.requests ?? []
  const total = data?.total ?? 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={24} />
            Onboarding Requests
          </h1>
          <p className="text-gray-500 text-sm mt-1">Review and approve new business account requests.</p>
        </div>
        {(pendingData > 0) && (
          <span className="bg-yellow-100 text-yellow-800 text-sm font-semibold px-3 py-1 rounded-full">
            {pendingData} pending
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 w-fit">
        {['pending', 'approved', 'rejected', ''].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No {statusFilter} requests</p>
          <p className="text-gray-400 text-sm mt-1">
            {statusFilter === 'pending' ? 'New enquiries from the website will appear here.' : 'Nothing to show for this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{total} request{total !== 1 ? 's' : ''}</p>
          {requests.map(req => (
            <RequestCard
              key={req.id}
              request={req}
              onApprove={setApprovingRequest}
              onReject={setRejectingRequest}
            />
          ))}
        </div>
      )}

      {approvingRequest && (
        <ApproveModal
          request={approvingRequest}
          onClose={() => setApprovingRequest(null)}
          onApprove={handleApprove}
        />
      )}
      {rejectingRequest && (
        <RejectModal
          request={rejectingRequest}
          onClose={() => setRejectingRequest(null)}
          onReject={handleReject}
        />
      )}
    </div>
  )
}
