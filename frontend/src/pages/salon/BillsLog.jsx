import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, ChevronDown, ChevronUp, Store, Download, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react'
import { salonAPI, outletsAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { exportToExcel } from '@/utils/exportExcel'
import { todayIST, formatTime, formatCurrency } from '@/utils/formatters'
import toast from 'react-hot-toast'

export default function SalonBillsLog() {
  const { tenant, user } = useAuthStore()
  const requiresApproval = useAuthStore(s => s.requiresApproval)
  const qc = useQueryClient()

  const [date, setDate] = useState(todayIST())
  const [selectedOutlet, setSelectedOutlet] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  // Direct cancel flow
  const [confirmCancel, setConfirmCancel] = useState(null)

  // Cancel request flow (for roles requiring approval)
  const [requestCancel, setRequestCancel] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  // Approve / reject modal for managers
  const [reviewModal, setReviewModal] = useState(null) // { request, action: 'approve' | 'reject' }
  const [reviewNote, setReviewNote] = useState('')

  const needsApproval = requiresApproval('billing.cancel')
  const isManager = ['owner', 'admin', 'manager'].includes(user?.role)

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletsAPI.list().then(r => r.data),
    enabled: !!tenant?.id,
  })

  const showOutletCol = outlets.length > 1

  const { data, isLoading } = useQuery({
    queryKey: ['salon-bills', tenant?.id, user?.id, date, selectedOutlet],
    queryFn: () => salonAPI.listBills({
      date,
      per_page: 100,
      ...(selectedOutlet ? { outlet_id: selectedOutlet } : {}),
    }).then(r => r.data),
    enabled: !!tenant?.id,
    refetchInterval: 15000,
  })

  const { data: cancelRequests = [] } = useQuery({
    queryKey: ['salon-cancel-requests', tenant?.id, 'pending'],
    queryFn: () => salonAPI.listCancelRequests({ status: 'pending' }).then(r => r.data),
    enabled: !!tenant?.id && isManager,
    refetchInterval: 12000,
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => salonAPI.cancelBill(id),
    onSuccess: () => {
      toast.success('Bill cancelled')
      setConfirmCancel(null)
      qc.invalidateQueries({ queryKey: ['salon-bills'] })
      qc.invalidateQueries({ queryKey: ['salon-summary'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to cancel bill'),
  })

  const requestCancelMutation = useMutation({
    mutationFn: ({ id, reason }) => salonAPI.requestCancelBill(id, { reason }),
    onSuccess: () => {
      toast.success('Cancel request submitted — waiting for manager approval')
      setRequestCancel(null)
      setCancelReason('')
      qc.invalidateQueries({ queryKey: ['salon-bills'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to submit request'),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, note }) => salonAPI.approveCancelRequest(id, { note }),
    onSuccess: (_, { billNumber }) => {
      toast.success('Cancel request approved — bill cancelled')
      setReviewModal(null)
      setReviewNote('')
      qc.invalidateQueries({ queryKey: ['salon-cancel-requests'] })
      qc.invalidateQueries({ queryKey: ['salon-bills'] })
      qc.invalidateQueries({ queryKey: ['salon-summary'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to approve'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }) => salonAPI.rejectCancelRequest(id, { note }),
    onSuccess: () => {
      toast.success('Cancel request rejected')
      setReviewModal(null)
      setReviewNote('')
      qc.invalidateQueries({ queryKey: ['salon-cancel-requests'] })
      qc.invalidateQueries({ queryKey: ['salon-bills'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to reject'),
  })

  const bills = data?.bills || []
  const paidRevenue = bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.total, 0)

  const canExport = useAuthStore(s => s.hasAction('reports.export'))

  const handleExport = () => {
    if (!bills.length) return
    const cols = [
      { key: 'bill_number',    label: 'Bill #' },
      { key: 'created_at',     label: 'Time',      format: v => formatTime(v) },
      { key: 'customer_name',  label: 'Customer',  format: v => v || 'Walk-in' },
      { key: 'customer_phone', label: 'Phone',     format: v => v || '' },
      { key: 'staff_name',     label: 'Staff',     format: v => v || '' },
      ...(showOutletCol ? [{ key: 'outlet_name', label: 'Outlet', format: v => v || '' }] : []),
      { key: 'subtotal',       label: 'Subtotal (₹)',      format: v => Number(v).toFixed(2) },
      { key: 'coupon_code',    label: 'Coupon',    format: v => v || '' },
      { key: 'coupon_discount',label: 'Coupon Disc (₹)',   format: v => Number(v).toFixed(2) },
      { key: 'total',          label: 'Total (₹)',         format: v => Number(v).toFixed(2) },
      { key: 'payment_method', label: 'Payment' },
      { key: 'status',         label: 'Status' },
    ]
    exportToExcel(bills, cols, `salon-bills-${date}${selectedOutlet ? `-outlet${selectedOutlet}` : ''}`)
  }

  const handleReviewSubmit = () => {
    if (!reviewModal) return
    const fn = reviewModal.action === 'approve' ? approveMutation : rejectMutation
    fn.mutate({ id: reviewModal.request.id, note: reviewNote })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList size={24} />
            Bills Log
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {bills.length} bill{bills.length !== 1 ? 's' : ''} on selected date
            {bills.length > 0 && ` · ${formatCurrency(paidRevenue)} revenue`}
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {showOutletCol && (
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
              <Store size={14} className="text-gray-400 flex-shrink-0" />
              <select
                className="text-sm border-none outline-none bg-transparent text-gray-700 cursor-pointer"
                value={selectedOutlet}
                onChange={e => setSelectedOutlet(e.target.value)}
              >
                <option value="">All Outlets</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
          <input
            type="date"
            className="input text-sm"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          {canExport && bills.length > 0 && (
            <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 text-sm">
              <Download size={14} /> Export
            </button>
          )}
        </div>
      </div>

      {/* Pending cancel requests panel — only for managers */}
      {isManager && cancelRequests.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-amber-600" />
            <h2 className="font-semibold text-amber-800 text-sm">
              Pending Cancel Requests ({cancelRequests.length})
            </h2>
          </div>
          <div className="space-y-2">
            {cancelRequests.map(cr => (
              <div key={cr.id} className="flex items-center justify-between gap-4 bg-white border border-amber-100 rounded-lg px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-mono font-medium text-gray-900">{cr.bill_number}</span>
                  <span className="text-gray-500 ml-2">{formatCurrency(cr.bill_total)}</span>
                  {cr.customer_name && <span className="text-gray-400 ml-2">· {cr.customer_name}</span>}
                  <div className="text-xs text-gray-400 mt-0.5">
                    Requested by <span className="font-medium text-gray-600">{cr.requested_by_name}</span>
                    {cr.reason && <> · "{cr.reason}"</>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setReviewModal({ request: cr, action: 'approve' }); setReviewNote('') }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700"
                  >
                    <CheckCircle size={12} /> Approve
                  </button>
                  <button
                    onClick={() => { setReviewModal({ request: cr, action: 'reject' }); setReviewNote('') }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bills table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : bills.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-xl">
          <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No bills on this date</p>
          <p className="text-gray-400 text-sm mt-1">Create a bill in Billing to see it here.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8 px-2 py-3" />
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Bill #</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Staff</th>
                {showOutletCol && (
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Outlet</th>
                )}
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Total</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Payment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {bills.map(bill => (
                <React.Fragment key={bill.id}>
                  <tr
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${bill.status === 'cancelled' ? 'opacity-50' : ''}`}
                    onClick={() => setExpandedId(expandedId === bill.id ? null : bill.id)}
                  >
                    <td className="px-2 py-3 text-gray-400">
                      {expandedId === bill.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatTime(bill.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{bill.bill_number}</td>
                    <td className="px-4 py-3 text-gray-900">
                      {bill.customer_name || <span className="text-gray-400">Walk-in</span>}
                      {bill.customer_phone && <div className="text-xs text-gray-400">{bill.customer_phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{bill.staff_name || <span className="text-gray-300">—</span>}</td>
                    {showOutletCol && (
                      <td className="px-4 py-3">
                        {bill.outlet_name ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                            <Store size={10} />
                            {bill.outlet_name}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {formatCurrency(bill.total)}
                      {bill.coupon_discount > 0 && (
                        <div className="text-xs font-normal text-green-600">-{formatCurrency(bill.coupon_discount)} off</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {bill.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          bill.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {bill.status}
                        </span>
                        {bill.cancel_request_status === 'pending' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            <Clock size={10} /> Pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {bill.status === 'paid' && bill.cancel_request_status !== 'pending' && (
                        needsApproval ? (
                          <button
                            onClick={() => { setRequestCancel(bill); setCancelReason('') }}
                            className="text-amber-500 hover:text-amber-700 text-xs font-medium"
                          >
                            Request Cancel
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmCancel(bill)}
                            className="text-red-400 hover:text-red-600 text-xs font-medium"
                          >
                            Cancel
                          </button>
                        )
                      )}
                    </td>
                  </tr>

                  {expandedId === bill.id && bill.items && (
                    <tr key={`${bill.id}-items`} className="border-b border-gray-100 bg-gray-50">
                      <td colSpan={showOutletCol ? 10 : 9} className="px-6 py-3">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Services Done</div>
                        <div className="space-y-1">
                          {bill.items.length === 0 ? (
                            <p className="text-xs text-gray-400">No items recorded</p>
                          ) : (
                            bill.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.item_type === 'package' ? 'bg-purple-400' : 'bg-brand-400'}`} />
                                  <span className="text-gray-900 font-medium">{item.item_name}</span>
                                  {item.quantity > 1 && <span className="text-gray-400 text-xs">×{item.quantity}</span>}
                                  <span className="text-xs text-gray-400 capitalize">{item.item_type}</span>
                                </div>
                                <span className="text-gray-700 font-medium flex-shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                              </div>
                            ))
                          )}
                        </div>
                        {bill.notes && (
                          <p className="text-xs text-gray-400 mt-2 italic">Note: {bill.notes}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Direct cancel confirmation modal (managers only) */}
      {confirmCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Cancel Bill?</h3>
            <p className="text-sm text-gray-500 mb-1">Bill: <span className="font-mono font-medium">{confirmCancel.bill_number}</span></p>
            <p className="text-sm text-gray-500 mb-5">Amount: <span className="font-medium">{formatCurrency(confirmCancel.total)}</span></p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmCancel(null)} className="btn-secondary flex-1">Keep</button>
              <button
                onClick={() => cancelMutation.mutate(confirmCancel.id)}
                disabled={cancelMutation.isPending}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel request modal (non-managers who need approval) */}
      {requestCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Request Bill Cancellation</h3>
            <p className="text-sm text-gray-500 mb-1">Bill: <span className="font-mono font-medium">{requestCancel.bill_number}</span></p>
            <p className="text-sm text-gray-500 mb-4">Amount: <span className="font-medium">{formatCurrency(requestCancel.total)}</span></p>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
            <textarea
              className="input w-full text-sm resize-none mb-4"
              rows={3}
              placeholder="Why do you want to cancel this bill?"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
            <p className="text-xs text-gray-400 mb-4">Your request will be sent to a manager for approval.</p>
            <div className="flex gap-3">
              <button onClick={() => { setRequestCancel(null); setCancelReason('') }} className="btn-secondary flex-1">Back</button>
              <button
                onClick={() => requestCancelMutation.mutate({ id: requestCancel.id, reason: cancelReason })}
                disabled={requestCancelMutation.isPending}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {requestCancelMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager approve/reject modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-1">
              {reviewModal.action === 'approve' ? 'Approve' : 'Reject'} Cancel Request
            </h3>
            <p className="text-sm text-gray-500 mb-1">
              Bill: <span className="font-mono font-medium">{reviewModal.request.bill_number}</span>
              <span className="ml-2">{formatCurrency(reviewModal.request.bill_total)}</span>
            </p>
            {reviewModal.request.reason && (
              <p className="text-xs text-gray-400 mb-3">Reason: "{reviewModal.request.reason}"</p>
            )}
            <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
            <textarea
              className="input w-full text-sm resize-none mb-4"
              rows={2}
              placeholder={reviewModal.action === 'approve' ? 'Note for approving...' : 'Reason for rejection...'}
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => { setReviewModal(null); setReviewNote('') }} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleReviewSubmit}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className={`flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 ${
                  reviewModal.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {(approveMutation.isPending || rejectMutation.isPending)
                  ? 'Processing...'
                  : reviewModal.action === 'approve' ? 'Approve & Cancel Bill' : 'Reject Request'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
