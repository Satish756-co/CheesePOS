const IST = 'Asia/Kolkata'

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-IN', {
    timeZone: IST,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const formatDateTime = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('en-IN', {
    timeZone: IST,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export const formatTime = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleTimeString('en-IN', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

// Returns a date string in YYYY-MM-DD format adjusted to IST
export const toISTDateString = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-CA', { timeZone: IST }) // en-CA gives YYYY-MM-DD
}

// For date inputs: get today's date as YYYY-MM-DD in IST
export const todayIST = () => toISTDateString(new Date())

export const formatNumber = (num) => {
  if (!num) return '0'
  return new Intl.NumberFormat('en-IN').format(num)
}

export const getStatusColor = (status) => {
  const map = {
    active: 'badge-green',
    trial: 'badge-blue',
    expired: 'badge-red',
    suspended: 'badge-red',
    pending: 'badge-yellow',
    paid: 'badge-green',
    unpaid: 'badge-red',
    partial: 'badge-yellow',
    cancelled: 'badge-gray',
    available: 'badge-green',
    occupied: 'badge-orange',
    order_placed: 'badge-blue',
    preparing: 'badge-yellow',
    ready: 'badge-green',
    billed: 'badge-gray',
    new: 'badge-blue',
    accepted: 'badge-orange',
    served: 'badge-green',
    open: 'badge-blue',
    in_progress: 'badge-yellow',
    resolved: 'badge-green',
    closed: 'badge-gray',
    approved: 'badge-green',
    received: 'badge-green',
    refunded: 'badge-yellow',
  }
  return map[status] || 'badge-gray'
}

export const TABLE_STATUS_COLORS = {
  available: 'bg-green-100 border-green-400 text-green-800',
  occupied: 'bg-orange-100 border-orange-400 text-orange-800',
  order_placed: 'bg-blue-100 border-blue-400 text-blue-800',
  preparing: 'bg-yellow-100 border-yellow-400 text-yellow-800',
  ready: 'bg-green-200 border-green-500 text-green-900',
  billed: 'bg-gray-100 border-gray-400 text-gray-800',
  reserved: 'bg-purple-100 border-purple-400 text-purple-800',
}
