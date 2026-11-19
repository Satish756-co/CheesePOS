import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Scissors, Package, ChevronDown, ChevronUp, X, Check } from 'lucide-react'
import { salonAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { useUserOutlets } from '@/hooks/useUserOutlets'
import toast from 'react-hot-toast'

function CategoryModal({ category, onClose, onSave }) {
  const [form, setForm] = useState({ name: category?.name || '', sort_order: category?.sort_order || 0 })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name.trim()) return toast.error('Name is required')
    setLoading(true)
    try { await onSave(form); onClose() } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold mb-4">{category ? 'Edit Category' : 'New Category'}</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="label">Sort Order</label>
            <input className="input" type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={loading} className="btn-primary flex-1">{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function ServiceModal({ service, categories, outlets, onClose, onSave }) {
  const [form, setForm] = useState({
    name: service?.name || '',
    category_id: service?.category_id || (categories[0]?.id || ''),
    price: service?.price || '',
    duration_minutes: service?.duration_minutes || 30,
    description: service?.description || '',
    is_active: service?.is_active !== false,
  })
  const [outletPrices, setOutletPrices] = useState({})
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!service?.id) return
    salonAPI.getServiceOutletPrices(service.id)
      .then(r => {
        const map = {}
        r.data.forEach(p => { map[p.outlet_id] = String(p.price) })
        setOutletPrices(map)
      })
      .catch(() => {})
  }, [service?.id])

  const submit = async () => {
    if (!form.name.trim()) return toast.error('Name is required')
    if (!form.price || isNaN(Number(form.price))) return toast.error('Valid price is required')
    setLoading(true)
    try {
      const res = await onSave({ ...form, price: Number(form.price), category_id: Number(form.category_id) })
      const serviceId = res?.data?.id || service?.id
      if (serviceId && outlets.length > 1) {
        const priceArray = outlets
          .filter(o => outletPrices[o.id] !== '' && outletPrices[o.id] !== undefined)
          .map(o => ({ outlet_id: o.id, price: Number(outletPrices[o.id]) }))
          .filter(p => !isNaN(p.price))
        await salonAPI.updateServiceOutletPrices(serviceId, priceArray)
      }
      onClose()
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">{service ? 'Edit Service' : 'New Service'}</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Default Price (₹)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} />
            </div>
            <div>
              <label className="label">Duration (min)</label>
              <input className="input" type="number" min="5" value={form.duration_minutes} onChange={e => set('duration_minutes', Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="label">Description <span className="text-gray-400 text-xs">(optional)</span></label>
            <input className="input" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
            Active
          </label>

          {outlets.length > 1 && (
            <div>
              <label className="label">Outlet-Specific Prices <span className="text-gray-400 text-xs">(leave blank to use default)</span></label>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {outlets.map(o => (
                  <div key={o.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-sm text-gray-700 flex-1 truncate">{o.name}</span>
                    <div className="flex items-center gap-1 w-28">
                      <span className="text-xs text-gray-400">₹</span>
                      <input
                        className="input py-1 text-sm"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={form.price || '—'}
                        value={outletPrices[o.id] || ''}
                        onChange={e => setOutletPrices(p => ({ ...p, [o.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={loading} className="btn-primary flex-1">{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function PackageModal({ pkg, services, outlets, onClose, onSave }) {
  const [form, setForm] = useState({
    name: pkg?.name || '',
    price: pkg?.price || '',
    description: pkg?.description || '',
    service_ids: (pkg?.services || []).map(s => s.service_id),
    is_active: pkg?.is_active !== false,
  })
  const [outletPrices, setOutletPrices] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!pkg?.id) return
    salonAPI.getPackageOutletPrices(pkg.id)
      .then(r => {
        const map = {}
        r.data.forEach(p => { map[p.outlet_id] = String(p.price) })
        setOutletPrices(map)
      })
      .catch(() => {})
  }, [pkg?.id])

  const toggleService = (id) => {
    setForm(f => ({
      ...f,
      service_ids: f.service_ids.includes(id)
        ? f.service_ids.filter(s => s !== id)
        : [...f.service_ids, id],
    }))
  }

  const submit = async () => {
    if (!form.name.trim()) return toast.error('Name is required')
    if (!form.price || isNaN(Number(form.price))) return toast.error('Valid price is required')
    setLoading(true)
    try {
      const res = await onSave({ ...form, price: Number(form.price) })
      const packageId = res?.data?.id || pkg?.id
      if (packageId && outlets.length > 1) {
        const priceArray = outlets
          .filter(o => outletPrices[o.id] !== '' && outletPrices[o.id] !== undefined)
          .map(o => ({ outlet_id: o.id, price: Number(outletPrices[o.id]) }))
          .filter(p => !isNaN(p.price))
        await salonAPI.updatePackageOutletPrices(packageId, priceArray)
      }
      onClose()
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">{pkg ? 'Edit Package' : 'New Package'}</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Package Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="label">Default Price (₹)</label>
            <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          </div>
          <div>
            <label className="label">Description <span className="text-gray-400 text-xs">(optional)</span></label>
            <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Included Services</label>
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              {services.length === 0 ? (
                <p className="text-xs text-gray-400 p-3">No services added yet</p>
              ) : services.map(s => (
                <label key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={form.service_ids.includes(s.id)} onChange={() => toggleService(s.id)} className="rounded" />
                  <span className="text-sm flex-1">{s.name}</span>
                  <span className="text-xs text-gray-400">₹{s.price}</span>
                </label>
              ))}
            </div>
          </div>

          {outlets.length > 1 && (
            <div>
              <label className="label">Outlet-Specific Prices <span className="text-gray-400 text-xs">(leave blank to use default)</span></label>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {outlets.map(o => (
                  <div key={o.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-sm text-gray-700 flex-1 truncate">{o.name}</span>
                    <div className="flex items-center gap-1 w-28">
                      <span className="text-xs text-gray-400">₹</span>
                      <input
                        className="input py-1 text-sm"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={form.price || '—'}
                        value={outletPrices[o.id] || ''}
                        onChange={e => setOutletPrices(p => ({ ...p, [o.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
            Active
          </label>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={loading} className="btn-primary flex-1">{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

export default function SalonServices() {
  const { tenant } = useAuthStore()
  const { outlets } = useUserOutlets()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('services')
  const [editCategory, setEditCategory] = useState(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editService, setEditService] = useState(null)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [editPackage, setEditPackage] = useState(null)
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState(null)

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['salon-categories', tenant?.id],
    queryFn: () => salonAPI.listCategories().then(r => r.data),
    enabled: !!tenant?.id,
  })

  const { data: services = [] } = useQuery({
    queryKey: ['salon-services', tenant?.id],
    queryFn: () => salonAPI.listServices({}).then(r => r.data),
    enabled: !!tenant?.id,
  })

  const { data: packages = [] } = useQuery({
    queryKey: ['salon-packages', tenant?.id],
    queryFn: () => salonAPI.listPackages().then(r => r.data),
    enabled: !!tenant?.id,
  })

  const catCreate = useMutation({
    mutationFn: (data) => salonAPI.createCategory(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salon-categories'] }); toast.success('Category created') },
    onError: () => toast.error('Failed to create category'),
  })

  const catUpdate = useMutation({
    mutationFn: ({ id, data }) => salonAPI.updateCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salon-categories'] }); toast.success('Category updated') },
    onError: () => toast.error('Failed to update category'),
  })

  const svcCreate = useMutation({
    mutationFn: (data) => salonAPI.createService(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salon-services'] }); toast.success('Service created') },
    onError: () => toast.error('Failed to create service'),
  })

  const svcUpdate = useMutation({
    mutationFn: ({ id, data }) => salonAPI.updateService(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salon-services'] }); toast.success('Service updated') },
    onError: () => toast.error('Failed to update service'),
  })

  const pkgCreate = useMutation({
    mutationFn: (data) => salonAPI.createPackage(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salon-packages'] }); toast.success('Package created') },
    onError: () => toast.error('Failed to create package'),
  })

  const pkgUpdate = useMutation({
    mutationFn: ({ id, data }) => salonAPI.updatePackage(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salon-packages'] }); toast.success('Package updated') },
    onError: () => toast.error('Failed to update package'),
  })

  const servicesByCategory = categories.map(cat => ({
    ...cat,
    services: services.filter(s => s.category_id === cat.id),
  }))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scissors size={24} />
            Services & Packages
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage your salon services, categories, and packages</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {['services', 'packages'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <p className="text-sm text-gray-500">{services.length} service{services.length !== 1 ? 's' : ''} in {categories.length} categories</p>
            <div className="flex gap-2">
              <button onClick={() => { setEditCategory(null); setShowCategoryModal(true) }} className="btn-secondary text-sm flex items-center gap-1.5">
                <Plus size={15} /> Add Category
              </button>
              <button
                onClick={() => { setEditService(null); setShowServiceModal(true) }}
                disabled={categories.length === 0}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                <Plus size={15} /> Add Service
              </button>
            </div>
          </div>

          {categories.length === 0 && (
            <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-xl">
              <Scissors size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No categories yet</p>
              <p className="text-gray-400 text-sm mt-1">Add a category first (e.g. Hair, Skin, Nails), then add services under it.</p>
              <button onClick={() => { setEditCategory(null); setShowCategoryModal(true) }} className="btn-primary mt-4 text-sm">
                Add First Category
              </button>
            </div>
          )}

          {servicesByCategory.map(cat => (
            <div key={cat.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
              >
                <div className="flex items-center gap-2">
                  {expandedCategory === cat.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  <span className="font-medium text-gray-900">{cat.name}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{cat.services.length}</span>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setEditCategory(cat); setShowCategoryModal(true) }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <Edit2 size={14} />
                </button>
              </div>
              {expandedCategory === cat.id && (
                <div className="border-t border-gray-100">
                  {cat.services.length === 0 ? (
                    <p className="text-sm text-gray-400 px-4 py-3">No services in this category yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Service</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Duration</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Price</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cat.services.map(svc => (
                          <tr key={svc.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-900">{svc.name}</td>
                            <td className="px-4 py-2.5 text-gray-500">{svc.duration_minutes} min</td>
                            <td className="px-4 py-2.5 font-medium">₹{Number(svc.price).toFixed(2)}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${svc.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {svc.is_active ? <Check size={10} /> : null}
                                {svc.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                onClick={() => { setEditService(svc); setShowServiceModal(true) }}
                                className="text-gray-400 hover:text-gray-700 p-1"
                              >
                                <Edit2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'packages' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{packages.length} package{packages.length !== 1 ? 's' : ''}</p>
            <button onClick={() => { setEditPackage(null); setShowPackageModal(true) }} className="btn-primary text-sm flex items-center gap-1.5">
              <Plus size={15} /> Add Package
            </button>
          </div>

          {packages.length === 0 ? (
            <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-xl">
              <Package size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No packages yet</p>
              <p className="text-gray-400 text-sm mt-1">Create combos bundling multiple services at a special price.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Package</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Includes</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Price</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {packages.map(pkg => (
                    <tr key={pkg.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{pkg.name}</p>
                        {pkg.description && <p className="text-xs text-gray-400 mt-0.5">{pkg.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {pkg.services?.length > 0
                          ? pkg.services.map(s => s.service_name).join(', ')
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 font-medium">₹{Number(pkg.price).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pkg.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {pkg.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setEditPackage(pkg); setShowPackageModal(true) }}
                          className="text-gray-400 hover:text-gray-700 p-1"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCategoryModal && (
        <CategoryModal
          category={editCategory}
          onClose={() => setShowCategoryModal(false)}
          onSave={(data) => editCategory
            ? catUpdate.mutateAsync({ id: editCategory.id, data })
            : catCreate.mutateAsync(data)
          }
        />
      )}

      {showServiceModal && (
        <ServiceModal
          service={editService}
          categories={categories}
          outlets={outlets}
          onClose={() => setShowServiceModal(false)}
          onSave={(data) => editService
            ? svcUpdate.mutateAsync({ id: editService.id, data })
            : svcCreate.mutateAsync(data)
          }
        />
      )}

      {showPackageModal && (
        <PackageModal
          pkg={editPackage}
          services={services}
          outlets={outlets}
          onClose={() => setShowPackageModal(false)}
          onSave={(data) => editPackage
            ? pkgUpdate.mutateAsync({ id: editPackage.id, data })
            : pkgCreate.mutateAsync(data)
          }
        />
      )}
    </div>
  )
}
