import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersAPI, outletsAPI } from '@/api'
import { formatDate } from '@/utils/formatters'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Plus, Edit2, X, User, Shield, Eye, EyeOff } from 'lucide-react'

const ROLES = [
  { value: 'owner', label: 'Owner', color: 'badge-orange' },
  { value: 'admin', label: 'Admin', color: 'badge-red' },
  { value: 'manager', label: 'Manager', color: 'badge-blue' },
  { value: 'cashier', label: 'Cashier', color: 'badge-green' },
  { value: 'waiter', label: 'Waiter', color: 'badge-blue' },
  { value: 'kitchen', label: 'Kitchen', color: 'badge-yellow' },
  { value: 'inventory_manager', label: 'Inventory Mgr', color: 'badge-gray' },
  { value: 'accountant', label: 'Accountant', color: 'badge-gray' },
]

function UserModal({ user, outlets, onClose, onSave }) {
  const [form, setForm] = useState(user ? {
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    password: '',
    outlet_ids: user.outlet_ids || [],
    is_active: user.is_active,
  } : {
    first_name: '', last_name: '', email: '', phone: '',
    role: 'cashier', password: '', outlet_ids: [], is_active: true,
  })
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleOutlet = (id) => {
    const ids = form.outlet_ids.includes(id)
      ? form.outlet_ids.filter(x => x !== id)
      : [...form.outlet_ids, id]
    u('outlet_ids', ids)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user && !form.password) { toast.error('Password is required'); return }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">{user ? 'Edit User' : 'Add User'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First Name *</label>
              <input className="input" value={form.first_name} onChange={e => u('first_name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input className="input" value={form.last_name} onChange={e => u('last_name', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" value={form.email} onChange={e => u('email', e.target.value)} required disabled={!!user} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => u('phone', e.target.value)} placeholder="Mobile number" />
            </div>
            <div>
              <label className="label">Role *</label>
              <select className="input" value={form.role} onChange={e => u('role', e.target.value)}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{user ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input pr-10"
                value={form.password}
                onChange={e => u('password', e.target.value)}
                placeholder={user ? 'Leave blank to keep current' : 'Set password'}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {outlets.length > 0 && (
            <div>
              <label className="label">Assign Outlets</label>
              <div className="space-y-2">
                {outlets.map(o => (
                  <label key={o.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={form.outlet_ids.includes(o.id)}
                      onChange={() => toggleOutlet(o.id)}
                    />
                    <span className="text-sm font-medium text-gray-700">{o.name}</span>
                    <span className="text-xs text-gray-400">{o.outlet_code}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {user && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => u('is_active', e.target.checked)} />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : user ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Users() {
  const qc = useQueryClient()
  const currentUserId = useAuthStore(s => s.user?.id)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.list().then(r => r.data),
  })

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletsAPI.list().then(r => r.data),
  })

  const createUser = useMutation({
    mutationFn: (data) => usersAPI.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User created') },
  })
  const updateUser = useMutation({
    mutationFn: ({ id, data }) => usersAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User updated') },
  })
  const toggleStatus = useMutation({
    mutationFn: ({ id, is_active }) => usersAPI.update(id, { is_active }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(vars.is_active ? 'User activated' : 'User deactivated — active sessions ended')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update status'),
  })

  const getRoleBadge = (role) => ROLES.find(r => r.value === role)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users & Roles</h1>
          <p className="text-sm text-gray-500">{users.length} team member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setEditUser(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add User
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <User size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600">No users yet</p>
          <button onClick={() => { setEditUser(null); setShowModal(true) }} className="btn-primary mt-4">Add First User</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Role</th>
                <th className="table-header">Outlets</th>
                <th className="table-header">Status</th>
                <th className="table-header">Joined</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => {
                const roleInfo = getRoleBadge(u.role)
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm flex-shrink-0">
                          {u.first_name?.[0]}{u.last_name?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                          <p className="text-xs text-gray-400">{u.employee_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-gray-600 text-sm">{u.email}</td>
                    <td className="table-cell">
                      <span className={`badge ${roleInfo?.color || 'badge-gray'} flex items-center gap-1 w-fit`}>
                        <Shield size={10} />
                        {roleInfo?.label || u.role}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      {u.outlet_ids?.length > 0
                        ? outlets.filter(o => u.outlet_ids.includes(o.id)).map(o => o.name).join(', ') || `${u.outlet_ids.length} outlet(s)`
                        : <span className="text-gray-300">All</span>}
                    </td>
                    <td className="table-cell">
                      {u.id === currentUserId ? (
                        <span className="badge badge-green">Active (you)</span>
                      ) : (
                        <button
                          onClick={() => toggleStatus.mutate({ id: u.id, is_active: !u.is_active })}
                          disabled={toggleStatus.isPending}
                          title={u.is_active ? 'Click to deactivate' : 'Click to activate'}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                            ${u.is_active ? 'bg-green-500' : 'bg-gray-300'}
                            ${toggleStatus.isPending ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:opacity-80'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                            ${u.is_active ? 'translate-x-6' : 'translate-x-1'}`}
                          />
                        </button>
                      )}
                    </td>
                    <td className="table-cell text-sm text-gray-500">{formatDate(u.created_at)}</td>
                    <td className="table-cell">
                      <button onClick={() => { setEditUser(u); setShowModal(true) }} className="text-brand-500 hover:text-brand-700">
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <UserModal
          user={editUser}
          outlets={outlets}
          onClose={() => setShowModal(false)}
          onSave={data => editUser
            ? updateUser.mutateAsync({ id: editUser.id, data })
            : createUser.mutateAsync(data)
          }
        />
      )}
    </div>
  )
}
