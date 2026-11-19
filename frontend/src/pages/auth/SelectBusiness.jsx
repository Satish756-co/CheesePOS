import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authAPI } from '@/api'
import toast from 'react-hot-toast'
import { Building2, ArrowRight, LogOut } from 'lucide-react'

const BIZ_TYPE_COLORS = {
  bar_restaurant: 'bg-orange-100 text-orange-700',
  saloon:         'bg-pink-100 text-pink-700',
  daily_store:    'bg-green-100 text-green-700',
  scanning_lab:   'bg-blue-100 text-blue-700',
  pharmacy:       'bg-teal-100 text-teal-700',
  retail_shop:    'bg-purple-100 text-purple-700',
  hr_operations:  'bg-gray-100 text-gray-700',
  other:          'bg-gray-100 text-gray-600',
}

const STATUS_COLORS = {
  active:  'bg-green-100 text-green-700',
  trial:   'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
  suspended: 'bg-orange-100 text-orange-700',
}

export default function SelectBusiness() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(null)

  const { selectionToken, businesses = [], user } = location.state || {}

  if (!selectionToken || !businesses.length) {
    navigate('/login', { replace: true })
    return null
  }

  const handleSelect = async (tenantId) => {
    setLoading(tenantId)
    try {
      const res = await authAPI.selectBusiness(selectionToken, tenantId)
      const { user: u, tenant, access_token, refresh_token, effective_permissions, businesses: biz } = res.data
      setAuth(u, tenant, access_token, refresh_token, effective_permissions, biz ?? [])
      toast.success(`Switched to ${tenant.business_name}`)
      navigate(useAuthStore.getState().getHomeRoute(), { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to select business')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Select a Business</h1>
          <p className="text-slate-400 text-sm">
            Welcome back, <span className="text-white font-medium">{user?.first_name}</span>!
            Choose which business you'd like to manage.
          </p>
        </div>

        {/* Business cards */}
        <div className="space-y-3">
          {businesses.map(biz => (
            <button
              key={biz.id}
              onClick={() => handleSelect(biz.id)}
              disabled={!!loading}
              className={`w-full bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/25
                rounded-xl p-4 flex items-center gap-4 transition-all text-left
                disabled:opacity-60 disabled:cursor-not-allowed
                ${loading === biz.id ? 'ring-2 ring-brand-400' : ''}`}
            >
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 size={22} className="text-white/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">{biz.business_name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BIZ_TYPE_COLORS[biz.business_type] || BIZ_TYPE_COLORS.other}`}>
                    {biz.business_type_label}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[biz.status] || 'bg-gray-100 text-gray-600'}`}>
                    {biz.status}
                  </span>
                  {biz.city && <span className="text-xs text-white/50">{biz.city}</span>}
                </div>
              </div>
              <div className="flex-shrink-0">
                {loading === biz.id ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowRight size={18} className="text-white/50" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Back to login */}
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mx-auto mt-8 transition-colors"
        >
          <LogOut size={14} />
          Back to login
        </button>
      </div>
    </div>
  )
}
