import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authAPI, usersAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { User, Lock, Building2, CreditCard, Eye, EyeOff, AlertTriangle, Clock } from 'lucide-react'
import { formatDate } from '@/utils/formatters'

const ROLE_LABELS = {
  owner: 'Owner', admin: 'Admin', manager: 'Manager', cashier: 'Cashier',
  waiter: 'Waiter', kitchen: 'Kitchen Staff', inventory_manager: 'Inventory Manager',
  accountant: 'Accountant',
}

function ProfileSection({ user }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <User size={18} className="text-brand-500" /> Your Profile
      </h2>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xl">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{user?.first_name} {user?.last_name}</p>
          <p className="text-gray-500">{user?.email}</p>
          <span className="badge badge-blue mt-1 inline-block">{ROLE_LABELS[user?.role] || user?.role}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500 mb-0.5">Employee Code</p>
          <p className="font-medium font-mono">{user?.employee_code || '—'}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-0.5">Phone</p>
          <p className="font-medium">{user?.phone || '—'}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-0.5">Joined</p>
          <p className="font-medium">{user?.created_at ? formatDate(user.created_at) : '—'}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-0.5">Status</p>
          <span className={`badge ${user?.is_active ? 'badge-green' : 'badge-red'}`}>
            {user?.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  )
}

function ChangePasswordSection() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [show, setShow] = useState({ current: false, new: false, confirm: false })
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const { setToken } = useAuthStore()

  const mutation = useMutation({
    mutationFn: () => authAPI.changePassword(form.current_password, form.new_password),
    onSuccess: (res) => {
      toast.success('Password changed — other devices have been logged out')
      setForm({ current_password: '', new_password: '', confirm_password: '' })
      // Save the fresh tokens so this session stays valid
      if (res.data?.access_token) {
        setToken(res.data.access_token)
        if (res.data.refresh_token) {
          useAuthStore.setState({ refreshToken: res.data.refresh_token })
        }
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to change password'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (form.new_password !== form.confirm_password) { toast.error('Passwords do not match'); return }
    if (form.new_password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    mutation.mutate()
  }

  const PasswordField = ({ label, field }) => (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type={show[field] ? 'text' : 'password'}
          className="input pr-10"
          value={form[`${field}_password`] || form[field === 'confirm' ? 'confirm_password' : `${field}_password`]}
          onChange={e => u(field === 'current' ? 'current_password' : field === 'new' ? 'new_password' : 'confirm_password', e.target.value)}
          required
        />
        <button type="button" onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          {show[field] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Lock size={18} className="text-brand-500" /> Change Password
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <div>
          <label className="label">Current Password</label>
          <div className="relative">
            <input type={show.current ? 'text' : 'password'} className="input pr-10" value={form.current_password}
              onChange={e => u('current_password', e.target.value)} required />
            <button type="button" onClick={() => setShow(s => ({ ...s, current: !s.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {show.current ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">New Password</label>
          <div className="relative">
            <input type={show.new ? 'text' : 'password'} className="input pr-10" value={form.new_password}
              onChange={e => u('new_password', e.target.value)} required />
            <button type="button" onClick={() => setShow(s => ({ ...s, new: !s.new }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {show.new ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">Confirm New Password</label>
          <div className="relative">
            <input type={show.confirm ? 'text' : 'password'} className="input pr-10" value={form.confirm_password}
              onChange={e => u('confirm_password', e.target.value)} required />
            <button type="button" onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {show.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Saving...' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}

function BusinessSection({ tenant }) {
  if (!tenant) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Building2 size={18} className="text-brand-500" /> Business Info
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="col-span-2">
          <p className="text-gray-500 mb-0.5">Business Name</p>
          <p className="font-bold text-base text-gray-900">{tenant.business_name}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-0.5">Email</p>
          <p className="font-medium">{tenant.email}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-0.5">Phone</p>
          <p className="font-medium">{tenant.phone || '—'}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-0.5">City</p>
          <p className="font-medium">{tenant.city || '—'}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-0.5">State</p>
          <p className="font-medium">{tenant.state || '—'}</p>
        </div>
        {tenant.gstin && (
          <div className="col-span-2">
            <p className="text-gray-500 mb-0.5">GSTIN</p>
            <p className="font-medium font-mono">{tenant.gstin}</p>
          </div>
        )}
        <div>
          <p className="text-gray-500 mb-0.5">Account Status</p>
          <span className={`badge ${tenant.status === 'active' ? 'badge-green' : tenant.status === 'trial' ? 'badge-blue' : 'badge-red'} capitalize`}>
            {tenant.status}
          </span>
        </div>
        {tenant.trial_ends_at && (
          <div>
            <p className="text-gray-500 mb-0.5">Trial Ends</p>
            <p className="font-medium">{formatDate(tenant.trial_ends_at)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function useCountdown(expiresAt) {
  const [display, setDisplay] = useState('')
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    const calc = () => {
      const diff = new Date(expiresAt) - Date.now()
      if (diff <= 0) { setDisplay('Expired'); setUrgent(true); return }
      const totalSec = Math.floor(diff / 1000)
      const days = Math.floor(totalSec / 86400)
      const hrs  = Math.floor((totalSec % 86400) / 3600)
      const mins = Math.floor((totalSec % 3600) / 60)
      if (days >= 2) {
        setDisplay(`${days} days`)
        setUrgent(false)
      } else if (days === 1) {
        setDisplay(`1 day ${hrs}h ${mins}m`)
        setUrgent(false)
      } else {
        setDisplay(`${hrs}h ${String(mins).padStart(2,'0')}m`)
        setUrgent(true)
      }
    }
    calc()
    const id = setInterval(calc, 30000)
    return () => clearInterval(id)
  }, [expiresAt])

  return { display, urgent }
}

const OPTION_LABELS = {
  invoices: 'Sales/Invoices', orders: 'Orders & KOTs', purchases: 'Purchases',
  inventory: 'Inventory', expenses: 'Expenses', staff_users: 'Staff Accounts',
}

function BatchTimer({ batch }) {
  const { display, urgent } = useCountdown(batch.expires_at)
  const tags = Object.entries(batch.options || {}).filter(([,v]) => v).map(([k]) => OPTION_LABELS[k] || k)
  const resetDate = new Date(batch.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className={`rounded-xl border-2 p-4 ${urgent ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className={urgent ? 'text-red-500' : 'text-amber-600'} />
            <span className={`text-sm font-semibold ${urgent ? 'text-red-700' : 'text-amber-800'}`}>
              Restorable for {display}
            </span>
          </div>
          <p className="text-xs text-gray-500">Reset on {resetDate} · Categories: {tags.join(', ') || '—'}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Contact admin to restore this data before the timer runs out. After that it is permanently gone.
      </p>
    </div>
  )
}

const RESET_OPTIONS = [
  { key: 'invoices', label: 'Sales / Invoices', desc: 'All billing records and payments' },
  { key: 'orders', label: 'Orders & KOTs', desc: 'Open/closed orders and kitchen tickets' },
  { key: 'purchases', label: 'Purchases', desc: 'Purchase orders from suppliers' },
  { key: 'inventory', label: 'Inventory', desc: 'Stock balances, ledger, transfers' },
  { key: 'expenses', label: 'Expenses', desc: 'All recorded expenses' },
  { key: 'staff_users', label: 'Staff Accounts', desc: 'Non-owner/admin user accounts' },
]

function ResetDataSection() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState({})
  const [confirm, setConfirm] = useState('')
  const [open, setOpen] = useState(false)

  const { data: batches = [] } = useQuery({
    queryKey: ['reset-batches'],
    queryFn: () => usersAPI.listResetBatches().then(r => r.data),
    staleTime: 60_000,
  })

  const toggle = (key) => setSelected(s => ({ ...s, [key]: !s[key] }))
  const anySelected = Object.values(selected).some(Boolean)

  const mutation = useMutation({
    mutationFn: () => usersAPI.resetData(selected, confirm),
    onSuccess: () => {
      toast.success('Data hidden. Restorable for 14 days via admin.')
      qc.invalidateQueries({ queryKey: ['reset-batches'] })
      setSelected({})
      setConfirm('')
      setOpen(false)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Reset failed'),
  })

  const canSubmit = anySelected && confirm === 'RESET' && !mutation.isPending

  return (
    <div className="bg-white rounded-2xl border-2 border-red-200 p-6 lg:col-span-2">
      {batches.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock size={14} className="text-amber-500" /> Pending Resets — Admin Can Restore
          </p>
          <div className="space-y-3">
            {batches.map(b => <BatchTimer key={b.id} batch={b} />)}
          </div>
        </div>
      )}

      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 w-full text-left">
        <AlertTriangle size={18} className="text-red-500" />
        <h2 className="text-lg font-bold text-red-700 flex-1">Danger Zone — Reset Data</h2>
        <span className="text-xs text-gray-400">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div className="mt-5">
          <p className="text-sm text-gray-600 mb-1">
            Selected data will be <strong>hidden immediately</strong> and kept for <strong>14 days</strong>.
            Admin can restore it within that window. After 14 days it is gone permanently.
          </p>
          <p className="text-xs text-gray-400 mb-4">Owner and Admin accounts are never deleted.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {RESET_OPTIONS.map(opt => (
              <label key={opt.key} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selected[opt.key] ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="checkbox" checked={!!selected[opt.key]} onChange={() => toggle(opt.key)} className="mt-0.5 accent-red-500" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {anySelected && (
            <div className="border-t border-red-100 pt-4">
              <p className="text-sm text-red-700 mb-2">Type <strong>RESET</strong> to confirm:</p>
              <input type="text" className="input mb-3 max-w-xs font-mono" placeholder="RESET" value={confirm} onChange={e => setConfirm(e.target.value)} />
              <br />
              <button onClick={() => mutation.mutate()} disabled={!canSubmit} className="px-6 py-2 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {mutation.isPending ? 'Processing…' : 'Reset Selected Data'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const user = useAuthStore(s => s.user)
  const tenant = useAuthStore(s => s.tenant)

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfileSection user={user} />
        <ChangePasswordSection />
        <BusinessSection tenant={tenant} />
        {['owner', 'admin'].includes(user?.role) && <ResetDataSection />}
      </div>
    </div>
  )
}
