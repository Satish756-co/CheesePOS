import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expensesAPI, usersAPI } from '@/api'
import { useUserOutlets } from '@/hooks/useUserOutlets'
import { formatCurrency, formatDate, todayIST } from '@/utils/formatters'
import { exportToExcel, EXPENSES_COLUMNS } from '@/utils/exportExcel'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Plus, X, Receipt, Edit2, Download } from 'lucide-react'

const EXPENSE_CATEGORIES = [
  'rent', 'electricity', 'salaries', 'maintenance',
  'transport', 'cleaning', 'marketing', 'other',
]

const PAYMENT_MODES = ['cash', 'bank_transfer', 'upi', 'cheque', 'card']

const CATEGORY_COLORS = {
  rent: 'badge-blue', electricity: 'badge-yellow', salaries: 'badge-orange',
  maintenance: 'badge-gray', transport: 'badge-blue', cleaning: 'badge-green',
  marketing: 'badge-red', other: 'badge-gray',
}

function ExpenseModal({ expense, outlets, onClose, onSave }) {
  const [form, setForm] = useState(expense ? {
    outlet_id: expense.outlet_id,
    expense_date: expense.expense_date,
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
    payment_mode: expense.payment_mode,
    reference_number: expense.reference_number || '',
    staff_id: expense.staff_id || '',
  } : {
    outlet_id: outlets[0]?.id || '',
    expense_date: todayIST(),
    category: 'other',
    description: '',
    amount: '',
    payment_mode: 'cash',
    reference_number: '',
    staff_id: '',
  })
  const [saving, setSaving] = useState(false)
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.list().then(r => r.data),
    enabled: form.category === 'salaries',
  })
  const staffUsers = users.filter(u => u.role !== 'owner' && u.is_active)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">{expense ? 'Edit Expense' : 'Add Expense'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Outlet *</label>
              <select className="input" value={form.outlet_id} onChange={e => u('outlet_id', parseInt(e.target.value))} required>
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" value={form.expense_date} onChange={e => u('expense_date', e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category *</label>
              <select className="input" value={form.category} onChange={e => { u('category', e.target.value); if (e.target.value !== 'salaries') u('staff_id', '') }}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount (₹) *</label>
              <input type="number" className="input" value={form.amount} onChange={e => u('amount', e.target.value)} required min="0" step="0.01" />
            </div>
          </div>
          {form.category === 'salaries' && (
            <div>
              <label className="label">Staff Member *</label>
              <select className="input" value={form.staff_id} onChange={e => u('staff_id', e.target.value ? parseInt(e.target.value) : '')} required>
                <option value="">— Select staff member —</option>
                {staffUsers.map(s => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.role})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Description *</label>
            <input className="input" value={form.description} onChange={e => u('description', e.target.value)} required placeholder="What was this expense for?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Payment Mode</label>
              <select className="input" value={form.payment_mode} onChange={e => u('payment_mode', e.target.value)}>
                {PAYMENT_MODES.map(m => <option key={m} value={m} className="capitalize">{m.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Reference No.</label>
              <input className="input" value={form.reference_number} onChange={e => u('reference_number', e.target.value)} placeholder="Bill / receipt no." />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : expense ? 'Update' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Expenses() {
  const qc = useQueryClient()
  const canExport = useAuthStore(s => s.hasAction('reports.export'))
  const [showModal, setShowModal] = useState(false)
  const [editExpense, setEditExpense] = useState(null)
  const [outletFilter, setOutletFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { outlets } = useUserOutlets()

  const { data: expenseData, isLoading } = useQuery({
    queryKey: ['expenses', outletFilter, categoryFilter, dateFrom, dateTo],
    queryFn: () => expensesAPI.list({
      outlet_id: outletFilter || undefined,
      category: categoryFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }).then(r => r.data),
  })

  const createExpense = useMutation({
    mutationFn: (data) => expensesAPI.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense added') },
  })
  const updateExpense = useMutation({
    mutationFn: ({ id, data }) => expensesAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense updated') },
  })

  const expenses = expenseData?.expenses || []
  const totalAmount = expenseData?.total_amount || 0

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500">{expenses.length} records · Total: {formatCurrency(totalAmount)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport && (
            <button onClick={() => exportToExcel(expenses, EXPENSES_COLUMNS, 'expenses')} className="btn-secondary flex items-center gap-2">
              <Download size={16} /> Export Excel
            </button>
          )}
          <button onClick={() => { setEditExpense(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select className="input w-40" value={outletFilter} onChange={e => setOutletFilter(e.target.value)}>
          <option value="">All Outlets</option>
          {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select className="input w-40" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
        <input type="date" className="input w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From date" />
        <input type="date" className="input w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To date" />
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Receipt size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600">No expenses recorded</p>
          <button onClick={() => { setEditExpense(null); setShowModal(true) }} className="btn-primary mt-4">Add First Expense</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Category</th>
                <th className="table-header">Description</th>
                <th className="table-header">Staff</th>
                <th className="table-header">Outlet</th>
                <th className="table-header">Payment</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="table-cell text-sm text-gray-500">{formatDate(e.expense_date)}</td>
                  <td className="table-cell">
                    <span className={`badge ${CATEGORY_COLORS[e.category] || 'badge-gray'} capitalize`}>{e.category}</span>
                  </td>
                  <td className="table-cell text-sm text-gray-700">{e.description}</td>
                  <td className="table-cell text-sm text-gray-500">
                    {e.category === 'salaries' && e.staff_name ? (
                      <span className="text-brand-600 font-medium">{e.staff_name}</span>
                    ) : '—'}
                  </td>
                  <td className="table-cell text-sm text-gray-500">{e.outlet_name || '—'}</td>
                  <td className="table-cell text-xs text-gray-400 capitalize">{e.payment_mode?.replace('_', ' ')}</td>
                  <td className="table-cell font-medium text-red-600">{formatCurrency(e.amount)}</td>
                  <td className="table-cell">
                    <button onClick={() => { setEditExpense(e); setShowModal(true) }} className="text-brand-500 hover:text-brand-700">
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={6} className="table-cell font-bold text-right text-gray-700">Total</td>
                <td className="table-cell font-bold text-red-600">{formatCurrency(totalAmount)}</td>
                <td className="table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showModal && (
        <ExpenseModal
          expense={editExpense}
          outlets={outlets}
          onClose={() => setShowModal(false)}
          onSave={data => editExpense
            ? updateExpense.mutateAsync({ id: editExpense.id, data })
            : createExpense.mutateAsync(data)
          }
        />
      )}
    </div>
  )
}
