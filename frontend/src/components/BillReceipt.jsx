import { createPortal } from 'react-dom'
import { useAuthStore } from '@/store/authStore'
import { X, Printer } from 'lucide-react'

// Format date as DD/MM/YYYY HH:MM in IST
function fmtDate(iso) {
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]))
  return `${parts.day}/${parts.month}/${parts.year}  ${parts.hour}:${parts.minute}`
}

function fmt(n) {
  return Number(n || 0).toFixed(2)
}

// Single separator line
function Sep() {
  return <div className="border-t border-dashed border-gray-400 my-1.5" />
}

// Row with label on left, value on right
function Row({ label, value, bold, indent = false }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${indent ? 'ml-2' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export default function BillReceipt({ invoice, onClose }) {
  const { tenant } = useAuthStore()

  const outlet = invoice.outlet || {}
  const items = invoice.items || []
  const payments = invoice.payments || []
  const taxBreakdown = invoice.tax_breakdown || {}
  const printerConfig = outlet.printer_config || {}
  const receiptConfig = outlet.receipt_config || {}

  const handlePrint = () => {
    const { paper_size = '80mm', orientation = 'portrait' } = printerConfig
    let pageCSS
    if (paper_size === '58mm') pageCSS = 'size: 58mm auto; margin: 2mm;'
    else if (paper_size === 'A4') pageCSS = `size: A4 ${orientation}; margin: 10mm;`
    else if (paper_size === 'A5') pageCSS = `size: A5 ${orientation}; margin: 8mm;`
    else pageCSS = 'size: 80mm auto; margin: 4mm;'

    const style = document.createElement('style')
    style.id = 'bill-print-style'
    style.innerHTML = `
      @media print {
        body > * { display: none !important; }
        #bill-print-root { display: block !important; }
        #bill-print-root { position: fixed; top: 0; left: 0; width: 100%; }
        @page { ${pageCSS} }
      }
    `
    document.head.appendChild(style)
    const el = document.getElementById('bill-print-root')
    const orig = el.style.display
    el.style.display = 'block'
    window.print()
    el.style.display = orig
    document.head.removeChild(style)
  }

  const businessName = tenant?.business_name || outlet.name || 'Restaurant'
  const outletAddr = [outlet.address, outlet.city].filter(Boolean).join(', ')
  const gstin = outlet.gstin || tenant?.gstin || ''
  const phone = outlet.phone || tenant?.phone || ''

  // Determine table / billing info
  const isTable = invoice.billing_type === 'table'
  const billNo = invoice.invoice_number
  const tableLabel = isTable ? (invoice.customer_name || '') : 'Counter'
  const dateStr = fmtDate(invoice.created_at)

  return (
    <>
      {/* Screen modal */}
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm flex flex-col max-h-[92vh]">
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Bill Receipt</h3>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg"
              >
                <Printer size={15} /> Print
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Receipt body — scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            <ReceiptContent
              businessName={businessName}
              outletAddr={outletAddr}
              phone={phone}
              gstin={gstin}
              billNo={billNo}
              dateStr={dateStr}
              tableLabel={tableLabel}
              isTable={isTable}
              invoice={invoice}
              items={items}
              payments={payments}
              taxBreakdown={taxBreakdown}
              printerConfig={printerConfig}
              receiptConfig={receiptConfig}
            />
          </div>
        </div>
      </div>

      {/* Hidden print-only version — portalled to document.body so print CSS works */}
      {createPortal(
        <div id="bill-print-root" style={{ display: 'none' }}>
          <ReceiptContent
            print
            businessName={businessName}
            outletAddr={outletAddr}
            phone={phone}
            gstin={gstin}
            billNo={billNo}
            dateStr={dateStr}
            tableLabel={tableLabel}
            isTable={isTable}
            invoice={invoice}
            items={items}
            payments={payments}
            taxBreakdown={taxBreakdown}
            printerConfig={printerConfig}
            receiptConfig={receiptConfig}
          />
        </div>,
        document.body
      )}
    </>
  )
}

function ReceiptContent({
  print = false,
  businessName, outletAddr, phone, gstin,
  billNo, dateStr, tableLabel, isTable,
  invoice, items, payments, taxBreakdown,
  printerConfig = {}, receiptConfig = {},
}) {
  const { paper_size = '80mm' } = printerConfig
  const {
    font_size = 'normal',
    show_gstin = true,
    show_tax_breakdown = true,
    show_payment_mode = true,
    footer_message,
  } = receiptConfig

  const FONT_PX = { small: '9px', normal: '11px', large: '13px' }
  const WIDTHS = { '80mm': '72mm', '58mm': '50mm', 'A4': '190mm', 'A5': '135mm' }

  const base = print
    ? { fontFamily: 'Courier New, monospace', fontSize: FONT_PX[font_size] || '11px', lineHeight: '1.4', color: '#000', width: WIDTHS[paper_size] || '72mm', padding: '2mm' }
    : {}

  return (
    <div
      style={base}
      className={print ? '' : 'font-mono text-xs text-gray-900 leading-snug'}
    >
      {/* ── HEADER ── */}
      <div className={print ? 'text-center' : 'text-center mb-1'}>
        <div className={print ? 'font-bold text-sm' : 'font-bold text-sm text-gray-900'}>
          {businessName}
        </div>
        {outletAddr && (
          <div className={print ? '' : 'text-gray-600 text-xs mt-0.5'}>{outletAddr}</div>
        )}
        {gstin && show_gstin && (
          <div className={print ? '' : 'text-gray-600 text-xs'}>GSTIN: {gstin}</div>
        )}
        {phone && (
          <div className={print ? '' : 'text-gray-600 text-xs'}>Tel: {phone}</div>
        )}
      </div>

      <Sep />

      {/* ── BILL META ── */}
      <div className={print ? '' : 'space-y-0.5'}>
        <Row label={`Bill No: ${billNo}`} value={dateStr} />
        {isTable && <Row label={`Table: ${tableLabel}`} value="" />}
        {invoice.customer_name && !isTable && (
          <Row label={`Customer: ${invoice.customer_name}`} value="" />
        )}
        {invoice.customer_phone && (
          <Row label={`Phone: ${invoice.customer_phone}`} value="" />
        )}
      </div>

      <Sep />

      {/* ── ITEMS HEADER ── */}
      <div
        style={print ? { display: 'flex', fontWeight: 'bold' } : undefined}
        className={print ? '' : 'font-bold text-gray-700 flex justify-between'}
      >
        <span style={print ? { flex: 1 } : undefined} className={print ? '' : 'flex-1'}>Dish</span>
        <span style={print ? { width: '32px', textAlign: 'center' } : undefined} className={print ? '' : 'w-12 text-center'}>Qty</span>
        <span style={print ? { width: '52px', textAlign: 'right' } : undefined} className={print ? '' : 'w-16 text-right'}>Amt</span>
      </div>

      <Sep />

      {/* ── ITEMS ── */}
      <div className={print ? '' : 'space-y-1'}>
        {items.map((item, i) => (
          <div
            key={i}
            style={print ? { display: 'flex', alignItems: 'flex-start' } : undefined}
            className={print ? '' : 'flex justify-between items-start'}
          >
            {/* Item name — may wrap */}
            <div
              style={print ? { flex: 1, paddingRight: '4px', lineHeight: '1.3' } : undefined}
              className={print ? '' : 'flex-1 pr-1 leading-tight'}
            >
              <span>{item.product_name}</span>
              {item.variant_name && <span style={print ? { color: '#666' } : undefined} className={print ? '' : 'text-gray-500'}> ({item.variant_name})</span>}
            </div>
            <div
              style={print ? { display: 'flex', gap: '4px', flexShrink: 0 } : undefined}
              className={print ? '' : 'flex-shrink-0 flex gap-1'}
            >
              <span style={print ? { width: '32px', textAlign: 'center' } : undefined} className={print ? '' : 'w-12 text-center'}>{Number(item.quantity)}</span>
              <span style={print ? { width: '52px', textAlign: 'right' } : undefined} className={print ? '' : 'w-16 text-right'}>{fmt(item.taxable_amount)}</span>
            </div>
          </div>
        ))}
      </div>

      <Sep />

      {/* ── SUBTOTAL ── */}
      <Row label="Subtotal :" value={fmt(invoice.taxable_amount)} />

      {/* ── TAX BREAKDOWN ── */}
      {show_tax_breakdown && Object.entries(taxBreakdown).map(([cat, info]) =>
        info.amount > 0 ? (
          <Row
            key={cat}
            label={`GST @${info.rate}%`}
            value={`+ ${fmt(info.amount)}`}
          />
        ) : null
      )}

      {/* ── DISCOUNT ── */}
      {invoice.discount_amount > 0 && (
        <Row label="Discount" value={`- ${fmt(invoice.discount_amount)}`} />
      )}

      {/* ── SERVICE CHARGE ── */}
      {invoice.service_charge > 0 && (
        <Row label="Service Charge" value={`+ ${fmt(invoice.service_charge)}`} />
      )}

      {/* ── ROUND OFF ── */}
      {Math.abs(invoice.round_off) > 0 && (
        <Row label="Round Off" value={fmt(invoice.round_off)} />
      )}

      <Sep />

      {/* ── GRAND TOTAL ── */}
      <Row label="Grand Total :" value={fmt(invoice.total_amount)} bold />

      <Sep />

      {/* ── NET TO PAY ── */}
      <div className={print ? 'font-bold text-center text-sm' : 'font-bold text-center text-sm text-gray-900 my-1'}>
        Net to Pay : ₹{fmt(Math.round(invoice.total_amount))}
      </div>

      {/* ── PAYMENT METHOD ── */}
      {show_payment_mode && payments.length > 0 && (
        <div className={print ? '' : 'space-y-0.5 text-center text-gray-600'}>
          {payments.map((p, i) => (
            <div key={i}>
              Paid via {p.payment_mode.toUpperCase()} : ₹{fmt(p.amount)}
            </div>
          ))}
          {invoice.change_amount > 0 && (
            <div>Change : ₹{fmt(invoice.change_amount)}</div>
          )}
        </div>
      )}

      <Sep />

      {/* ── FOOTER ── */}
      <div className={print ? 'text-center' : 'text-center text-gray-500'}>
        <div>{footer_message || 'Thank you, visit again!'}</div>
        <div className={print ? '' : 'text-gray-400 text-xs mt-0.5'}>
          {invoice.billing_type === 'table' ? 'Table Copy' : 'Counter Copy'}
        </div>
      </div>
    </div>
  )
}
