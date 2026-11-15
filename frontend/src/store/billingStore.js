import { create } from 'zustand'

export const useBillingStore = create((set, get) => ({
  cart: [],
  selectedOutlet: null,
  billingType: 'counter',
  selectedTable: null,
  customerName: '',
  customerPhone: '',
  discount: 0,
  idempotencyKey: null,

  setOutlet: (outlet) => set({ selectedOutlet: outlet }),
  setBillingType: (type) => set({ billingType: type }),
  setTable: (table) => set({ selectedTable: table }),
  setCustomer: (name, phone) => set({ customerName: name, customerPhone: phone }),
  setDiscount: (discount) => set({ discount }),

  addItem: (product, variant = null, qty = 1) => {
    const cart = get().cart
    const key = `${product.id}_${variant?.id || 'base'}`
    const existing = cart.find(item => item.key === key)

    if (existing) {
      set({
        cart: cart.map(item =>
          item.key === key
            ? { ...item, quantity: item.quantity + qty }
            : item
        )
      })
    } else {
      const price = variant ? variant.selling_price : product.selling_price
      set({
        cart: [...cart, {
          key,
          product_id: product.id,
          variant_id: variant?.id || null,
          product_name: product.name,
          variant_name: variant?.variant_name || null,
          price,
          quantity: qty,
          tax_category: product.tax_category || null,
          is_liquor: product.is_liquor,
          requires_kot: product.requires_kot,
          discount_percent: 0,
        }]
      })
    }
  },

  updateQty: (key, qty) => {
    if (qty <= 0) {
      set({ cart: get().cart.filter(item => item.key !== key) })
    } else {
      set({
        cart: get().cart.map(item =>
          item.key === key ? { ...item, quantity: qty } : item
        )
      })
    }
  },

  removeItem: (key) => set({ cart: get().cart.filter(item => item.key !== key) }),

  clearCart: () => set({
    cart: [],
    customerName: '',
    customerPhone: '',
    discount: 0,
    selectedTable: null,
    idempotencyKey: null,
  }),

  generateIdempotencyKey: () => {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    set({ idempotencyKey: key })
    return key
  },

  getSubtotal: () => get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0),

  getTotals: () => {
    const TAX_RATES = { gst_0: 0, gst_5: 5, gst_12: 12, gst_18: 18, gst_28: 28, liquor_ap: 0, exempt: 0 }
    const cart = get().cart
    const discount = get().discount
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const discountAmt = (subtotal * discount) / 100
    const tax = cart.reduce((sum, item) => {
      const rate = TAX_RATES[item.tax_category] || 0
      const taxable = item.price * item.quantity * (1 - discount / 100)
      return sum + taxable * rate / 100
    }, 0)
    const taxable = subtotal - discountAmt
    const total = taxable + tax
    return { subtotal, discountAmt, taxable, tax, total: Math.round(total) }
  },
}))
