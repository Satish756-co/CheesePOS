import * as XLSX from 'xlsx'
import { formatDateTime, formatDate } from './formatters'

// Prevent Excel/LibreOffice formula injection by prefixing dangerous characters
function sanitizeCell(val) {
  if (typeof val !== 'string') return val
  if (val.length > 0 && '=+-@\t\r'.includes(val[0])) return `'${val}`
  return val
}

/**
 * Export an array of row objects to an .xlsx file.
 *
 * @param {Object[]} rows - Array of plain data objects
 * @param {Array<{key: string, label: string, format?: Function}>} columns
 *   - key: property name on each row object
 *   - label: column header text
 *   - format: optional function (value, row) => display string
 * @param {string} filename - file name without extension
 * @param {string} [sheetName]
 */
export function exportToExcel(rows, columns, filename, sheetName = 'Data') {
  const header = columns.map(c => c.label)
  const body = rows.map(row =>
    columns.map(c => {
      const val = row[c.key]
      if (c.format) return sanitizeCell(c.format(val, row))
      if (val === null || val === undefined) return ''
      return sanitizeCell(typeof val === 'string' ? val : val)
    })
  )

  const ws = XLSX.utils.aoa_to_sheet([header, ...body])

  // Auto-column widths (capped at 40)
  ws['!cols'] = columns.map((c, i) => {
    const max = Math.max(
      c.label.length,
      ...body.map(r => String(r[i] ?? '').length)
    )
    return { wch: Math.min(max + 2, 40) }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ─── Pre-built column definitions for each page ───────────────────────────────

export const SALES_LOG_COLUMNS = [
  { key: 'created_at',    label: 'Date & Time',   format: v => formatDateTime(v) },
  { key: 'invoice_number',label: 'Invoice #' },
  { key: 'billing_type',  label: 'Type',          format: v => v === 'table' ? 'Table' : 'Counter' },
  { key: 'customer_name', label: 'Customer',       format: v => v || '-' },
  { key: 'outlet_name',   label: 'Outlet',         format: (v, row) => row.outlet?.name || '-' },
  { key: 'items_count',   label: 'Items' },
  { key: 'total_amount',  label: 'Total (₹)',      format: v => Number(v).toFixed(2) },
  { key: 'tax_amount',    label: 'Tax (₹)',        format: v => Number(v).toFixed(2) },
  { key: 'discount_amount',label: 'Discount (₹)',  format: v => Number(v).toFixed(2) },
  { key: 'payment_status',label: 'Payment Status' },
  { key: 'status',        label: 'Status' },
]

export const EXPENSES_COLUMNS = [
  { key: 'expense_date',  label: 'Date',          format: v => formatDate(v) },
  { key: 'category',      label: 'Category',      format: v => v?.replace(/_/g, ' ') },
  { key: 'description',   label: 'Description' },
  { key: 'outlet_name',   label: 'Outlet' },
  { key: 'amount',        label: 'Amount (₹)',    format: v => Number(v).toFixed(2) },
  { key: 'payment_mode',  label: 'Payment Mode' },
  { key: 'status',        label: 'Status' },
]

export const ORDERS_COLUMNS = [
  { key: 'created_at',    label: 'Date & Time',   format: v => formatDateTime(v) },
  { key: 'order_number',  label: 'Order #' },
  { key: 'order_type',    label: 'Type' },
  { key: 'outlet_name',   label: 'Outlet',        format: (v, row) => row.outlet?.name || '-' },
  { key: 'table_number',  label: 'Table',         format: (v, row) => row.table?.table_number || '-' },
  { key: 'customer_name', label: 'Customer',      format: v => v || '-' },
  { key: 'total_amount',  label: 'Total (₹)',     format: v => Number(v || 0).toFixed(2) },
  { key: 'status',        label: 'Status' },
]

export const INVENTORY_COLUMNS = [
  { key: 'product_name',  label: 'Product' },
  { key: 'category_name', label: 'Category',      format: (v, row) => row.category || '-' },
  { key: 'variant_name',  label: 'Variant',       format: v => v || '-' },
  { key: 'current_stock', label: 'Stock Qty',     format: v => Number(v).toFixed(3) },
  { key: 'unit',          label: 'Unit' },
  { key: 'avg_cost',      label: 'Avg Cost (₹)',  format: v => Number(v || 0).toFixed(2) },
  { key: 'stock_value',   label: 'Stock Value (₹)', format: (v, row) => (Number(row.current_stock) * Number(row.avg_cost || 0)).toFixed(2) },
  { key: 'is_low_stock',  label: 'Low Stock',     format: v => v ? 'Yes' : 'No' },
]

export const PRODUCTS_COLUMNS = [
  { key: 'name',          label: 'Product Name' },
  { key: 'brand',         label: 'Brand',         format: v => v || '-' },
  { key: 'sku',           label: 'SKU',           format: v => v || '-' },
  { key: 'category_name', label: 'Category' },
  { key: 'product_type',  label: 'Type' },
  { key: 'selling_price', label: 'Selling Price (₹)', format: v => Number(v).toFixed(2) },
  { key: 'purchase_price',label: 'Purchase Price (₹)', format: v => Number(v || 0).toFixed(2) },
  { key: 'tax_category',  label: 'Tax Category',  format: v => v || '-' },
  { key: 'is_active',     label: 'Active',        format: v => v ? 'Yes' : 'No' },
]

export const PURCHASES_COLUMNS = [
  { key: 'created_at',    label: 'Date',          format: v => formatDate(v) },
  { key: 'purchase_number',label: 'PO #' },
  { key: 'supplier_name', label: 'Supplier',      format: (v, row) => row.supplier?.name || '-' },
  { key: 'invoice_number',label: 'Invoice #',     format: v => v || '-' },
  { key: 'subtotal',      label: 'Subtotal (₹)',  format: v => Number(v).toFixed(2) },
  { key: 'tax_amount',    label: 'Tax (₹)',       format: v => Number(v).toFixed(2) },
  { key: 'total_amount',  label: 'Total (₹)',     format: v => Number(v).toFixed(2) },
  { key: 'paid_amount',   label: 'Paid (₹)',      format: v => Number(v).toFixed(2) },
  { key: 'balance_amount',label: 'Balance (₹)',   format: v => Number(v).toFixed(2) },
  { key: 'status',        label: 'Status' },
  { key: 'payment_status',label: 'Payment Status' },
]

export const REPORT_PRODUCT_SALES_COLUMNS = [
  { key: 'product_name',  label: 'Product' },
  { key: 'variant_name',  label: 'Variant',       format: v => v || '-' },
  { key: 'total_qty',     label: 'Qty Sold',      format: v => Number(v).toFixed(0) },
  { key: 'total_revenue', label: 'Revenue (₹)',   format: v => Number(v).toFixed(2) },
  { key: 'order_count',   label: 'Order Count' },
]

export const REPORT_DAILY_SALES_COLUMNS = [
  { key: 'date',   label: 'Date' },
  { key: 'sales',  label: 'Sales (₹)',  format: v => Number(v).toFixed(2) },
  { key: 'bills',  label: 'Bills' },
]

export const REPORT_PAYMENT_MODES_COLUMNS = [
  { key: 'mode',   label: 'Payment Mode', format: v => v?.replace(/_/g, ' ')?.toUpperCase() },
  { key: 'total',  label: 'Amount (₹)',   format: v => Number(v).toFixed(2) },
  { key: 'count',  label: 'Transactions' },
]
