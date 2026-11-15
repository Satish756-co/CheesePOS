import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminAPI } from '@/api'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { CreditCard, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const STATUS_STYLES = {
  active: 'badge-green',
  trial: 'badge-blue',
  cancelled: 'badge-red',
  expired: 'badge-red',
  pending: 'badge-yellow',
}

export default function AdminSubscriptions() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscriptions', statusFilter, page],
    queryFn: () => adminAPI.listSubscriptions({ status: statusFilter || undefined, page }).then(r => r.data),
  })

  const subscriptions = data?.subscriptions || []
  const totalPages = data?.pages || 1

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-sm text-gray-500">{data?.total || 0} subscriptions</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <select className="input w-44" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600">No subscriptions found</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Tenant</th>
                  <th className="table-header">Plan</th>
                  <th className="table-header">Cycle</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Started</th>
                  <th className="table-header">Expires</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subscriptions.map(sub => (
                  <tr key={sub.id} className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => sub.tenant_id && navigate(`/admin/tenants/${sub.tenant_id}`)}>
                    <td className="table-cell font-medium">{sub.tenant_name || `Tenant #${sub.tenant_id}`}</td>
                    <td className="table-cell text-sm text-gray-700">{sub.plan_name || `Plan #${sub.plan_id}`}</td>
                    <td className="table-cell text-sm text-gray-500 capitalize">{sub.billing_cycle}</td>
                    <td className="table-cell font-medium">{formatCurrency(sub.amount)}</td>
                    <td className="table-cell">
                      <span className={`badge ${STATUS_STYLES[sub.status] || 'badge-gray'} capitalize`}>{sub.status}</span>
                    </td>
                    <td className="table-cell text-sm text-gray-500">{formatDate(sub.starts_at)}</td>
                    <td className="table-cell text-sm text-gray-500">{formatDate(sub.ends_at)}</td>
                    <td className="table-cell">
                      <ChevronRight size={16} className="text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm py-1.5 px-3">Previous</button>
              <span className="text-sm text-gray-500 py-1.5">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-sm py-1.5 px-3">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
