import { useQuery } from '@tanstack/react-query'
import { adminAPI } from '@/api'
import { formatCurrency, formatNumber, formatDate } from '@/utils/formatters'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Users, Building2, CreditCard, IndianRupee, TrendingUp, AlertCircle,
  CheckCircle, Clock, Headphones, Activity
} from 'lucide-react'

function AdminStatCard({ label, value, icon: Icon, color = 'text-brand-500', bg = 'bg-brand-50', sub }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        <div className={`p-2 rounded-lg ${bg} ${color}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminAPI.getDashboard().then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: tenants } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => adminAPI.listTenants({ per_page: 5 }).then(r => r.data),
  })

  if (isLoading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  )

  const s = stats || {}

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-sm text-gray-500">CheesePOS – SaaS Overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <AdminStatCard label="Total Customers" value={formatNumber(s.total_customers)} icon={Users} color="text-brand-500" bg="bg-brand-50" />
        <AdminStatCard label="Active" value={formatNumber(s.active_customers)} icon={CheckCircle} color="text-green-500" bg="bg-green-50" />
        <AdminStatCard label="Trial" value={formatNumber(s.trial_customers)} icon={Clock} color="text-blue-500" bg="bg-blue-50" />
        <AdminStatCard label="Expired" value={formatNumber(s.expired_customers)} icon={AlertCircle} color="text-red-500" bg="bg-red-50" />
        <AdminStatCard label="Total Outlets" value={formatNumber(s.total_outlets)} icon={Building2} color="text-purple-500" bg="bg-purple-50" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminStatCard
          label="Monthly Recurring Revenue"
          value={formatCurrency(s.mrr)}
          icon={IndianRupee}
          color="text-brand-600"
          bg="bg-brand-50"
          sub="Active subscriptions"
        />
        <AdminStatCard
          label="Annual Recurring Revenue"
          value={formatCurrency(s.arr)}
          icon={TrendingUp}
          color="text-green-600"
          bg="bg-green-50"
          sub="MRR × 12"
        />
        <AdminStatCard
          label="This Month Revenue"
          value={formatCurrency(s.month_revenue)}
          icon={CreditCard}
          color="text-purple-600"
          bg="bg-purple-50"
          sub={`${s.new_customers_this_month || 0} new customers`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent customers */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Customers</h3>
          <div className="space-y-3">
            {(tenants?.tenants || []).map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-sm">
                  {t.business_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{t.business_name}</p>
                  <p className="text-xs text-gray-400">{t.city} • {formatDate(t.created_at)}</p>
                </div>
                <span className={`badge ${
                  t.status === 'active' ? 'badge-green' :
                  t.status === 'trial' ? 'badge-blue' :
                  t.status === 'expired' ? 'badge-red' : 'badge-gray'
                }`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* System status */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">System Status</h3>
          <div className="space-y-3">
            {[
              { label: 'API Server', status: 'operational' },
              { label: 'Database', status: 'operational' },
              { label: 'Redis Cache', status: 'operational' },
              { label: 'Payment Gateway', status: 'operational' },
              { label: 'Email Service', status: 'operational' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-gray-400" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <span className="badge badge-green">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse" />
                  {item.status}
                </span>
              </div>
            ))}
          </div>

          {s.open_support_tickets > 0 && (
            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
              <Headphones size={16} className="text-orange-500" />
              <p className="text-sm text-orange-700">
                {s.open_support_tickets} support ticket{s.open_support_tickets > 1 ? 's' : ''} need attention
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
