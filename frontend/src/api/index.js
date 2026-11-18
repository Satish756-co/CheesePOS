import api from './client'

export const authAPI = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  logout: () =>
    api.post('/auth/logout'),

  getMe: () =>
    api.get('/auth/me'),

  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),

  refresh: (refreshToken) =>
    api.post('/auth/refresh', {}, {
      headers: { Authorization: `Bearer ${refreshToken}` }
    }),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, new_password: newPassword }),

  setInitialPassword: (newPassword) =>
    api.post('/auth/set-initial-password', { new_password: newPassword }),
}

export const tenantsAPI = {
  register: (data) =>
    api.post('/tenants/register', data),
}

export const contactAPI = {
  submitEnquiry: (data) =>
    api.post('/contact/', data),
}

export const dashboardAPI = {
  getSummary: (params) =>
    api.get('/dashboard/summary', { params }),

  getSalesChart: (params) =>
    api.get('/dashboard/sales-chart', { params }),

  getTopProducts: (params) =>
    api.get('/dashboard/top-products', { params }),

  getOutletComparison: (params) =>
    api.get('/dashboard/outlet-comparison', { params }),

  getDaily: (params) =>
    api.get('/dashboard/daily', { params }),
}

export const outletsAPI = {
  list: () => api.get('/outlets/'),
  create: (data) => api.post('/outlets/', data),
  update: (id, data) => api.put(`/outlets/${id}`, data),
  get: (id) => api.get(`/outlets/${id}`),
  getTables: (id) => api.get(`/outlets/${id}/tables`),
  createTable: (id, data) => api.post(`/outlets/${id}/tables`, data),
  updateTable: (outletId, tableId, data) => api.put(`/outlets/${outletId}/tables/${tableId}`, data),
}

export const productsAPI = {
  list: (params) => api.get('/products/', { params }),
  create: (data) => api.post('/products/', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  toggle: (id, field, value) => api.put(`/products/${id}`, { [field]: value }),
  get: (id) => api.get(`/products/${id}`),
  listCategories: () => api.get('/products/categories'),
  createCategory: (data) => api.post('/products/categories', data),
  uploadImage: (id, formData) => api.post(`/products/${id}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
}

export const billingAPI = {
  createInvoice: (data) => api.post('/billing/create', data),
  listInvoices: (params) => api.get('/billing/invoices', { params }),
  getInvoice: (id) => api.get(`/billing/invoice/${id}`),
  cancelInvoice: (id, reason) => api.post(`/billing/invoice/${id}/cancel`, { reason }),
}

export const ordersAPI = {
  list: (params) => api.get('/orders/', { params }),
  create: (data) => api.post('/orders/', data),
  get: (id) => api.get(`/orders/${id}`),
  addItems: (id, data) => api.post(`/orders/${id}/items`, data),
  updateItem: (orderId, itemId, data) => api.patch(`/orders/${orderId}/items/${itemId}`, data),
  removeItem: (orderId, itemId) => api.delete(`/orders/${orderId}/items/${itemId}`),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
}

export const kotAPI = {
  list: (params) => api.get('/kot/', { params }),
  create: (data) => api.post('/kot/', data),
  updateStatus: (id, status) => api.put(`/kot/${id}/status`, { status }),
}

export const inventoryAPI = {
  getCurrentStock: (params) => api.get('/inventory/current-stock', { params }),
  adjust: (data) => api.post('/inventory/adjust', data),
  getLedger: (params) => api.get('/inventory/ledger', { params }),
  createTransfer: (data) => api.post('/inventory/transfer', data),
}

export const purchasesAPI = {
  listSuppliers: () => api.get('/purchases/suppliers'),
  createSupplier: (data) => api.post('/purchases/suppliers', data),
  list: (params) => api.get('/purchases/', { params }),
  create: (data) => api.post('/purchases/', data),
  get: (id) => api.get(`/purchases/${id}`),
  update: (id, data) => api.patch(`/purchases/${id}`, data),
}

export const expensesAPI = {
  list: (params) => api.get('/expenses/', { params }),
  create: (data) => api.post('/expenses/', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
}

export const reportsAPI = {
  sales: (params) => api.get('/reports/sales', { params }),
  productSales: (params) => api.get('/reports/product-sales', { params }),
  paymentModes: (params) => api.get('/reports/payment-modes', { params }),
  profitLoss: (params) => api.get('/reports/profit-loss', { params }),
}

export const usersAPI = {
  list: () => api.get('/users/'),
  create: (data) => api.post('/users/', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  get: (id) => api.get(`/users/${id}`),
  resetData: (options, confirm) => api.post('/users/reset-data', { options, confirm }),
  listResetBatches: () => api.get('/users/reset-batches'),
}

export const roleConfigAPI = {
  list: () => api.get('/users/role-configs'),
  update: (role, data) => api.put(`/users/role-configs/${role}`, data),
  reset: (role) => api.post(`/users/role-configs/${role}/reset`),
}

export const subscriptionsAPI = {
  getPlans: () => api.get('/subscriptions/plans'),
  getConfig: () => api.get('/subscriptions/config'),
  getCurrent: () => api.get('/subscriptions/current'),
  createOrder: (data) => api.post('/subscriptions/create-order', data),
  verifyPayment: (data) => api.post('/subscriptions/verify-payment', data),
}

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  listTenants: (params) => api.get('/admin/tenants', { params }),
  getTenant: (id) => api.get(`/admin/tenants/${id}`),
  updateTenant: (id, data) => api.put(`/admin/tenants/${id}`, data),
  listPlans: () => api.get('/admin/plans'),
  createPlan: (data) => api.post('/admin/plans', data),
  updatePlan: (id, data) => api.put(`/admin/plans/${id}`, data),
  getRevenue: (params) => api.get('/admin/revenue', { params }),
  listSubscriptions: (params) => api.get('/admin/subscriptions', { params }),
  activateSubscription: (data) => api.post('/admin/activate-subscription', data),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
  resetTenantData: (id, options, confirm) => api.post(`/admin/tenants/${id}/reset-data`, { options, confirm }),
  listResetBatches: (id) => api.get(`/admin/tenants/${id}/reset-batches`),
  restoreBatch: (tenantId, batchId) => api.post(`/admin/tenants/${tenantId}/reset-batches/${batchId}/restore`),
  purgeBatch: (tenantId, batchId) => api.post(`/admin/tenants/${tenantId}/reset-batches/${batchId}/purge`),
  createTenant: (data) => api.post('/admin/tenants', data),
  deleteTenant: (id) => api.delete(`/admin/tenants/${id}`),
  reactivateTenant: (id) => api.post(`/admin/tenants/${id}/reactivate`),
  resetUserPassword: (tenantId, userId) => api.post(`/admin/tenants/${tenantId}/users/${userId}/reset-password`),
}

export const supportAPI = {
  listTickets: (params) => api.get('/support/tickets', { params }),
  createTicket: (data) => api.post('/support/tickets', data),
  getTicket: (id) => api.get(`/support/tickets/${id}`),
  reply: (id, data) => api.post(`/support/tickets/${id}/reply`, data),
  updateStatus: (id, status) => api.patch(`/support/tickets/${id}/status`, { status }),
  submitFeedback: (id, data) => api.patch(`/support/tickets/${id}/feedback`, data),
  markRead: (id) => api.patch(`/support/tickets/${id}/read`),
  getUnreadCount: () => api.get('/support/unread-count'),
}
