import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsAPI } from '@/api'
import { formatCurrency } from '@/utils/formatters'
import { exportToExcel, PRODUCTS_COLUMNS } from '@/utils/exportExcel'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Package, X, Tag, Download, Camera, ImageOff } from 'lucide-react'

const PRODUCT_TYPES = ['food', 'liquor', 'beverage']
const TAX_CATEGORIES = [
  { value: 'gst_5', label: 'GST 5%' },
  { value: 'gst_12', label: 'GST 12%' },
  { value: 'gst_18', label: 'GST 18%' },
  { value: 'gst_28', label: 'GST 28%' },
  { value: 'liquor_ap', label: 'Liquor AP (Excise)' },
  { value: 'exempt', label: 'Exempt' },
]

const CATEGORY_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

function CategoryManagerModal({ categories, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('both')
  const [color, setColor] = useState('#6366f1')
  const [saving, setSaving] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await productsAPI.createCategory({ name: name.trim(), category_type: type, color })
      toast.success(`Category "${name}" created`)
      setName('')
      onCreated()
    } catch {
      toast.error('Failed to create category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">Manage Categories</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5">
          <form onSubmit={handleAdd} className="flex gap-2 mb-4">
            <input
              className="input flex-1"
              placeholder="Category name (e.g. Whisky, Snacks)"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
            <select className="input w-28" value={type} onChange={e => setType(e.target.value)}>
              <option value="both">Both</option>
              <option value="bar">Bar</option>
              <option value="food">Food</option>
            </select>
            <button type="submit" disabled={saving} className="btn-primary px-3">
              {saving ? '...' : <Plus size={16} />}
            </button>
          </form>
          <div className="flex gap-2 flex-wrap mb-4">
            {CATEGORY_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: color === c ? '#1f2937' : 'transparent' }}
              />
            ))}
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {categories?.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No categories yet. Add one above.</p>
            )}
            {(categories || []).map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#6366f1' }} />
                <span className="text-sm font-medium text-gray-800 flex-1">{c.name}</span>
                <span className="text-xs text-gray-400 capitalize">{c.category_type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductModal({ product, categories, onClose, onSave, onManageCategories }) {
  const [form, setForm] = useState(product || {
    name: '', brand: '', sku: '', product_type: 'food', category_id: '',
    selling_price: '', purchase_price: '', mrp: '',
    tax_category: 'gst_5', tax_inclusive: true, is_liquor: false,
    requires_kot: true, low_stock_threshold: 10,
    variants: []
  })
  const [saving, setSaving] = useState(false)
  const [pendingImage, setPendingImage] = useState(null)   // File object
  const [imagePreview, setImagePreview] = useState(null)   // local blob URL
  const fileRef = useRef(null)

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleImagePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const addVariant = () => {
    update('variants', [...(form.variants || []), { variant_name: '', selling_price: '', size_ml: '' }])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await onSave(form)
      const savedId = res?.data?.id || product?.id
      if (pendingImage && savedId) {
        const fd = new FormData()
        fd.append('image', pendingImage)
        await productsAPI.uploadImage(savedId, fd)
      }
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const currentImage = imagePreview || form.image_url

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">{product ? 'Edit Product' : 'Add Product'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Image upload */}
          <div>
            <label className="label">Product Image</label>
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 hover:border-brand-400 transition-colors overflow-hidden flex items-center justify-center flex-shrink-0 group"
              >
                {currentImage ? (
                  <>
                    <img src={currentImage} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={20} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-300">
                    <Camera size={22} />
                    <span className="text-xs text-center">Upload</span>
                  </div>
                )}
              </button>
              <div className="text-sm text-gray-500 pt-1">
                <p className="font-medium text-gray-700">Product photo</p>
                <p className="text-xs mt-0.5">Shown on billing screens to help staff identify items quickly.</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP · recommended 400×400px</p>
                {currentImage && (
                  <button
                    type="button"
                    onClick={() => { setPendingImage(null); setImagePreview(null); update('image_url', null) }}
                    className="text-xs text-red-500 hover:text-red-700 mt-1"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Product Name *</label>
              <input className="input" value={form.name} onChange={e => update('name', e.target.value)} required placeholder="e.g. Royal Stag" />
            </div>
            <div>
              <label className="label">Brand</label>
              <input className="input" value={form.brand || ''} onChange={e => update('brand', e.target.value)} placeholder="Brand name" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Category *</label>
                <button type="button" onClick={onManageCategories} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                  <Plus size={11} /> New
                </button>
              </div>
              <select className="input" value={form.category_id} onChange={e => update('category_id', parseInt(e.target.value))} required>
                <option value="">Select category</option>
                {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Product Type</label>
              <select className="input" value={form.product_type} onChange={e => {
                update('product_type', e.target.value)
                update('is_liquor', e.target.value === 'liquor')
              }}>
                {PRODUCT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tax Category</label>
              <select className="input" value={form.tax_category} onChange={e => update('tax_category', e.target.value)}>
                {TAX_CATEGORIES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Selling Price (₹) *</label>
              <input type="number" className="input" value={form.selling_price} onChange={e => update('selling_price', e.target.value)} required min="0" step="0.01" />
            </div>
            <div>
              <label className="label">Purchase Price (₹)</label>
              <input type="number" className="input" value={form.purchase_price || ''} onChange={e => update('purchase_price', e.target.value)} min="0" step="0.01" />
            </div>
            <div>
              <label className="label">SKU</label>
              <input className="input" value={form.sku || ''} onChange={e => update('sku', e.target.value)} placeholder="Product code" />
            </div>
            <div>
              <label className="label">Low Stock Alert (qty)</label>
              <input type="number" className="input" value={form.low_stock_threshold} onChange={e => update('low_stock_threshold', e.target.value)} min="0" />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.requires_kot} onChange={e => update('requires_kot', e.target.checked)} />
              <span className="text-sm">Send to Kitchen/Bar (KOT)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_liquor} onChange={e => update('is_liquor', e.target.checked)} />
              <span className="text-sm">Liquor item</span>
            </label>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Variants (sizes)</label>
              <button type="button" onClick={addVariant} className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1">
                <Plus size={14} /> Add size
              </button>
            </div>
            {(form.variants || []).map((v, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input className="input flex-1" placeholder="e.g. 750ml" value={v.variant_name}
                  onChange={e => {
                    const vars = [...form.variants]
                    vars[i].variant_name = e.target.value
                    update('variants', vars)
                  }} />
                <input type="number" className="input w-28" placeholder="Price ₹" value={v.selling_price}
                  onChange={e => {
                    const vars = [...form.variants]
                    vars[i].selling_price = e.target.value
                    update('variants', vars)
                  }} />
                <button type="button" onClick={() => update('variants', form.variants.filter((_, j) => j !== i))}>
                  <X size={16} className="text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Products() {
  const qc = useQueryClient()
  const canExport = useAuthStore(s => s.hasAction('reports.export'))
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)

  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productsAPI.listCategories().then(r => r.data),
  })

  const { data: productData } = useQuery({
    queryKey: ['products', search, selectedCategory],
    queryFn: () => productsAPI.list({ search, category_id: selectedCategory, include_variants: true }).then(r => r.data),
  })

  const createProduct = useMutation({
    mutationFn: (data) => productsAPI.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Product added') },
  })
  const updateProduct = useMutation({
    mutationFn: ({ id, data }) => productsAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Product updated') },
  })

  const products = productData?.products || []

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">{productData?.total || 0} products</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport && (
            <button onClick={() => exportToExcel(products, PRODUCTS_COLUMNS, 'products')} className="btn-secondary flex items-center gap-2">
              <Download size={16} /> Export Excel
            </button>
          )}
          <button onClick={() => setShowCategoryModal(true)} className="btn-secondary flex items-center gap-2">
            <Tag size={16} /> Categories
          </button>
          <button onClick={() => { setEditProduct(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-44" value={selectedCategory || ''} onChange={e => setSelectedCategory(e.target.value ? parseInt(e.target.value) : null)}>
          <option value="">All categories</option>
          {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header w-12"></th>
              <th className="table-header">Product</th>
              <th className="table-header">Category</th>
              <th className="table-header">Type</th>
              <th className="table-header">Price</th>
              <th className="table-header">Tax</th>
              <th className="table-header">Status</th>
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="table-cell">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-base">{p.is_liquor ? '🍺' : '🍽️'}</span>
                    )}
                  </div>
                </td>
                <td className="table-cell">
                  <div>
                    <p className="font-medium text-gray-900">{p.name}</p>
                    {p.brand && <p className="text-xs text-gray-400">{p.brand}</p>}
                    {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
                  </div>
                </td>
                <td className="table-cell text-gray-600">{p.category_name}</td>
                <td className="table-cell">
                  <span className={`badge ${p.is_liquor ? 'badge-orange' : 'badge-blue'} capitalize`}>
                    {p.product_type}
                  </span>
                </td>
                <td className="table-cell font-medium">{formatCurrency(p.selling_price)}</td>
                <td className="table-cell text-xs text-gray-500">{p.tax_category}</td>
                <td className="table-cell">
                  <span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="table-cell">
                  <button
                    onClick={() => { setEditProduct(p); setShowModal(true) }}
                    className="text-brand-500 hover:text-brand-700"
                  >
                    <Edit2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>No products yet. Add your first product.</p>
          </div>
        )}
      </div>

      {showCategoryModal && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setShowCategoryModal(false)}
          onCreated={() => { refetchCategories(); qc.invalidateQueries({ queryKey: ['categories'] }) }}
        />
      )}

      {showModal && (
        <ProductModal
          product={editProduct}
          categories={categories}
          onClose={() => setShowModal(false)}
          onManageCategories={() => setShowCategoryModal(true)}
          onSave={data => editProduct
            ? updateProduct.mutateAsync({ id: editProduct.id, data })
            : createProduct.mutateAsync(data)
          }
        />
      )}
    </div>
  )
}
