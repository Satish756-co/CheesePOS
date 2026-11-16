import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { outletsAPI } from '@/api'
import toast from 'react-hot-toast'
import { Plus, Edit2, X, MapPin, Phone, Mail, Table2, ChevronRight, Store, Printer } from 'lucide-react'

const OUTLET_TYPES = [
  { value: 'bar_restaurant', label: 'Bar & Restaurant' },
  { value: 'bar', label: 'Bar Only' },
  { value: 'restaurant', label: 'Restaurant Only' },
]

const FLOOR_SECTIONS = ['Main Hall', 'Terrace', 'VIP Room', 'Lounge', 'Outdoor', 'Private Dining']

// ── Outlet Modal ────────────────────────────────────────────────────
function OutletModal({ outlet, initialTab = 'details', onClose, onSave }) {
  const [tab, setTab] = useState(initialTab)
  const defaultPC = { paper_size: '80mm', orientation: 'portrait', copies: 1, auto_print: false }
  const defaultRC = { show_gstin: true, show_tax_breakdown: true, show_payment_mode: true, footer_message: 'Thank you for visiting!', font_size: 'normal' }

  const [form, setForm] = useState({
    name: outlet?.name || '',
    outlet_type: outlet?.outlet_type || 'bar_restaurant',
    phone: outlet?.phone || '',
    email: outlet?.email || '',
    address: outlet?.address || '',
    city: outlet?.city || '',
    state: outlet?.state || '',
    gstin: outlet?.gstin || '',
    excise_license: outlet?.excise_license || '',
    printer_config: { ...defaultPC, ...(outlet?.printer_config || {}) },
    receipt_config: { ...defaultRC, ...(outlet?.receipt_config || {}) },
  })
  const [saving, setSaving] = useState(false)
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const uPC = (k, v) => setForm(f => ({ ...f, printer_config: { ...f.printer_config, [k]: v } }))
  const uRC = (k, v) => setForm(f => ({ ...f, receipt_config: { ...f.receipt_config, [k]: v } }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setTab('details'); toast.error('Outlet name is required'); return }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save outlet')
    } finally {
      setSaving(false)
    }
  }

  const pc = form.printer_config
  const rc = form.receipt_config
  const isPOS = pc.paper_size === '80mm' || pc.paper_size === '58mm'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">{outlet ? 'Edit Outlet' : 'Add Outlet'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
          {['details', 'printer'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'details' ? 'Outlet Details' : 'Printer & Receipt'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {tab === 'details' && (
            <>
              <div>
                <label className="label">Outlet Name *</label>
                <input className="input" value={form.name} onChange={e => u('name', e.target.value)} placeholder="e.g. Main Branch" />
              </div>
              <div>
                <label className="label">Outlet Type</label>
                <select className="input" value={form.outlet_type} onChange={e => u('outlet_type', e.target.value)}>
                  {OUTLET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={form.phone} onChange={e => u('phone', e.target.value)} placeholder="Contact number" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={e => u('email', e.target.value)} placeholder="outlet@email.com" />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <textarea className="input resize-none h-16" value={form.address} onChange={e => u('address', e.target.value)} placeholder="Street address" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">City</label>
                  <input className="input" value={form.city} onChange={e => u('city', e.target.value)} placeholder="City" />
                </div>
                <div>
                  <label className="label">State</label>
                  <input className="input" value={form.state} onChange={e => u('state', e.target.value)} placeholder="State" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">GSTIN</label>
                  <input className="input" value={form.gstin} onChange={e => u('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
                </div>
                <div>
                  <label className="label">Excise License</label>
                  <input className="input" value={form.excise_license} onChange={e => u('excise_license', e.target.value)} placeholder="License number" />
                </div>
              </div>
            </>
          )}

          {tab === 'printer' && (
            <>
              <div>
                <label className="label">Paper Size</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: '80mm', label: '80mm POS' },
                    { value: '58mm', label: '58mm POS' },
                    { value: 'A4', label: 'A4 Sheet' },
                    { value: 'A5', label: 'A5 Sheet' },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${
                      pc.paper_size === opt.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="paper_size"
                        value={opt.value}
                        checked={pc.paper_size === opt.value}
                        onChange={() => uPC('paper_size', opt.value)}
                        className="accent-brand-600"
                      />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {!isPOS && (
                <div>
                  <label className="label">Orientation</label>
                  <div className="flex gap-3">
                    {['portrait', 'landscape'].map(o => (
                      <label key={o} className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl cursor-pointer flex-1 justify-center transition-colors ${
                        pc.orientation === o ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="radio"
                          name="orientation"
                          value={o}
                          checked={pc.orientation === o}
                          onChange={() => uPC('orientation', o)}
                          className="accent-brand-600"
                        />
                        <span className="text-sm font-medium capitalize">{o}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Copies per Bill</label>
                  <input
                    type="number"
                    className="input"
                    value={pc.copies}
                    min="1"
                    max="5"
                    onChange={e => uPC('copies', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!pc.auto_print}
                      onChange={e => uPC('auto_print', e.target.checked)}
                      className="accent-brand-600"
                    />
                    <span className="text-sm font-medium">Auto-print on new bill</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Receipt Content</p>
              </div>

              <div className="space-y-2.5">
                {[
                  { key: 'show_gstin', label: 'Show GSTIN on receipt' },
                  { key: 'show_tax_breakdown', label: 'Show tax breakdown' },
                  { key: 'show_payment_mode', label: 'Show payment mode' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!rc[key]}
                      onChange={e => uRC(key, e.target.checked)}
                      className="accent-brand-600"
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="label">Font Size</label>
                <div className="flex gap-2">
                  {['small', 'normal', 'large'].map(s => (
                    <label key={s} className={`flex items-center gap-2 px-3 py-2 border rounded-xl cursor-pointer flex-1 justify-center transition-colors ${
                      rc.font_size === s ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="font_size"
                        value={s}
                        checked={rc.font_size === s}
                        onChange={() => uRC('font_size', s)}
                        className="accent-brand-600"
                      />
                      <span className="text-sm font-medium capitalize">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Footer Message</label>
                <input
                  className="input"
                  value={rc.footer_message}
                  onChange={e => uRC('footer_message', e.target.value)}
                  placeholder="Thank you for visiting!"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : outlet ? 'Update Outlet' : 'Create Outlet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Table Modal ──────────────────────────────────────────────────────
function TableModal({ table, onClose, onSave }) {
  const [form, setForm] = useState(table || {
    table_number: '', floor_section: 'Main Hall', seating_capacity: 4,
  })
  const [saving, setSaving] = useState(false)
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save table')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">{table ? 'Edit Table' : 'Add Table'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Table Number *</label>
            <input className="input" value={form.table_number} onChange={e => u('table_number', e.target.value)} required placeholder="e.g. T1, A1, 01" />
          </div>
          <div>
            <label className="label">Section</label>
            <select className="input" value={form.floor_section} onChange={e => u('floor_section', e.target.value)}>
              {FLOOR_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Seating Capacity</label>
            <input type="number" className="input" value={form.seating_capacity} onChange={e => u('seating_capacity', parseInt(e.target.value))} min="1" max="20" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : table ? 'Update' : 'Add Table'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tables Panel ─────────────────────────────────────────────────────
function TablesPanel({ outlet, onClose }) {
  const qc = useQueryClient()
  const [showTableModal, setShowTableModal] = useState(false)
  const [editTable, setEditTable] = useState(null)

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', outlet.id],
    queryFn: () => outletsAPI.getTables(outlet.id).then(r => r.data),
  })

  const createTable = useMutation({
    mutationFn: (data) => outletsAPI.createTable(outlet.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tables', outlet.id] }); toast.success('Table added') },
  })
  const updateTable = useMutation({
    mutationFn: ({ id, data }) => outletsAPI.updateTable(outlet.id, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tables', outlet.id] }); toast.success('Table updated') },
  })

  const STATUS_COLORS = {
    available: 'bg-green-100 text-green-700',
    occupied: 'bg-red-100 text-red-700',
    reserved: 'bg-yellow-100 text-yellow-700',
    billed: 'bg-blue-100 text-blue-700',
    cleaning: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{outlet.name} — Tables</h3>
            <p className="text-sm text-gray-500">{tables.length} table{tables.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditTable(null); setShowTableModal(true) }} className="btn-primary flex items-center gap-1 text-sm py-1.5 px-3">
              <Plus size={14} /> Add Table
            </button>
            <button onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {tables.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Table2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No tables yet</p>
              <p className="text-sm mt-1">Add tables for this outlet to enable table billing</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {tables.map(t => (
                <div key={t.id} className="border border-gray-200 rounded-xl p-3 hover:border-brand-300 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-lg font-bold text-gray-900">{t.table_number}</span>
                    <button onClick={() => { setEditTable(t); setShowTableModal(true) }} className="text-gray-400 hover:text-brand-500">
                      <Edit2 size={13} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{t.floor_section} · {t.seating_capacity} seats</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-600'}`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showTableModal && (
        <TableModal
          table={editTable}
          onClose={() => setShowTableModal(false)}
          onSave={data => editTable
            ? updateTable.mutateAsync({ id: editTable.id, data })
            : createTable.mutateAsync(data)
          }
        />
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────
export default function Outlets() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editOutlet, setEditOutlet] = useState(null)
  const [editInitialTab, setEditInitialTab] = useState('details')
  const [tablesOutlet, setTablesOutlet] = useState(null)

  const openEdit = (outlet, tab = 'details') => {
    setEditOutlet(outlet)
    setEditInitialTab(tab)
    setShowModal(true)
  }

  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletsAPI.list().then(r => r.data),
  })

  const createOutlet = useMutation({
    mutationFn: (data) => outletsAPI.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['outlets'] }); toast.success('Outlet created') },
  })
  const updateOutlet = useMutation({
    mutationFn: ({ id, data }) => outletsAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['outlets'] }); toast.success('Outlet updated') },
  })

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outlets</h1>
          <p className="text-sm text-gray-500">{outlets.length} outlet{outlets.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={() => openEdit(null)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Outlet
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : outlets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Store size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600">No outlets yet</p>
          <p className="text-sm mt-1">Add your first outlet to start billing</p>
          <button onClick={() => openEdit(null)} className="btn-primary mt-4">
            Add Your First Outlet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {outlets.map(outlet => (
            <div key={outlet.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg leading-tight">{outlet.name}</h3>
                  <span className="text-xs text-gray-400">{outlet.outlet_code}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(outlet, 'details')} className="text-gray-400 hover:text-brand-500" title="Edit outlet">
                    <Edit2 size={15} />
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <span className="text-xs font-medium bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full capitalize">
                  {OUTLET_TYPES.find(t => t.value === outlet.outlet_type)?.label || outlet.outlet_type}
                </span>
                {outlet.is_active ? (
                  <span className="ml-2 text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                ) : (
                  <span className="ml-2 text-xs font-medium bg-red-50 text-red-700 px-2 py-0.5 rounded-full">Inactive</span>
                )}
              </div>

              <div className="space-y-1.5 text-sm text-gray-500 mb-4">
                {(outlet.city || outlet.state) && (
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="flex-shrink-0" />
                    <span>{[outlet.address, outlet.city, outlet.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {outlet.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="flex-shrink-0" />
                    <span>{outlet.phone}</span>
                  </div>
                )}
                {outlet.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="flex-shrink-0" />
                    <span className="truncate">{outlet.email}</span>
                  </div>
                )}
                {outlet.gstin && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400">GST</span>
                    <span className="font-mono text-xs">{outlet.gstin}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setTablesOutlet(outlet)}
                  className="flex-1 flex items-center justify-between text-sm text-brand-600 hover:text-brand-700 font-medium border border-brand-200 hover:border-brand-400 rounded-xl px-3 py-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Table2 size={14} />
                    Manage Tables
                  </div>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => openEdit(outlet, 'printer')}
                  className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 font-medium border border-gray-200 hover:border-gray-400 rounded-xl px-3 py-2 transition-colors"
                  title="Printer & receipt settings"
                >
                  <Printer size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <OutletModal
          outlet={editOutlet}
          initialTab={editInitialTab}
          onClose={() => setShowModal(false)}
          onSave={data => editOutlet
            ? updateOutlet.mutateAsync({ id: editOutlet.id, data })
            : createOutlet.mutateAsync(data)
          }
        />
      )}

      {tablesOutlet && (
        <TablesPanel
          outlet={tablesOutlet}
          onClose={() => setTablesOutlet(null)}
        />
      )}
    </div>
  )
}
