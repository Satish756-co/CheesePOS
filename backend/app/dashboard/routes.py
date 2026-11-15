from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import datetime, timedelta
from sqlalchemy import func, and_
from app.extensions import db
from app.models import (
    Invoice, BillPayment, Expense, StockBalance, Product,
    Outlet, Order, KOT, Purchase, PurchaseItem, InvoiceItem
)
from app.auth.decorators import tenant_required
from app.utils import ist_today, ist_days_ago, parse_ist_date, parse_ist_date_end, IST_OFFSET

dashboard_bp = Blueprint('dashboard', __name__)


def get_tenant_outlet_filter(claims, outlet_id=None):
    tenant_id = claims.get('tenant_id')
    filters = {'tenant_id': tenant_id}
    if outlet_id:
        filters['outlet_id'] = outlet_id
    return tenant_id, filters


@dashboard_bp.route('/summary', methods=['GET'])
@jwt_required()
@tenant_required
def get_summary():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    date_from = request.args.get('date_from', ist_today())
    date_to = request.args.get('date_to', ist_today())

    dt_from = parse_ist_date(date_from)
    dt_to = parse_ist_date_end(date_to)

    invoice_q = Invoice.query.filter(
        Invoice.tenant_id == tenant_id,
        Invoice.status != 'cancelled',
        Invoice.created_at >= dt_from,
        Invoice.created_at < dt_to,
        Invoice.reset_batch_id.is_(None),
    )
    if outlet_id:
        invoice_q = invoice_q.filter(Invoice.outlet_id == outlet_id)

    invoices = invoice_q.all()

    total_sales = sum(float(i.total_amount) for i in invoices)
    total_bills = len(invoices)
    cash_collection = sum(float(p.amount) for i in invoices
                         for p in i.payments.filter_by(payment_mode='cash').all())
    upi_collection = sum(float(p.amount) for i in invoices
                        for p in i.payments.filter_by(payment_mode='upi').all())
    card_collection = sum(float(p.amount) for i in invoices
                         for p in i.payments.filter_by(payment_mode='card').all())

    from datetime import date as date_type
    expense_q = Expense.query.filter(
        Expense.tenant_id == tenant_id,
        Expense.status == 'approved',
        Expense.expense_date >= date_type.fromisoformat(date_from),
        Expense.expense_date <= date_type.fromisoformat(date_to),
        Expense.reset_batch_id.is_(None),
    )
    if outlet_id:
        expense_q = expense_q.filter(Expense.outlet_id == outlet_id)

    total_expenses = sum(float(e.amount) for e in expense_q.all())

    return jsonify({
        'today_sales': total_sales,
        'total_bills': total_bills,
        'cash_collection': cash_collection,
        'upi_collection': upi_collection,
        'card_collection': card_collection,
        'total_expenses': total_expenses,
        'net_sales': total_sales - total_expenses,
        'date_from': date_from,
        'date_to': date_to,
    })


@dashboard_bp.route('/sales-chart', methods=['GET'])
@jwt_required()
@tenant_required
def get_sales_chart():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    period = request.args.get('period', 'week')  # week, month, year
    outlet_id = request.args.get('outlet_id', type=int)

    now = datetime.utcnow() + IST_OFFSET  # use IST "now" for rolling windows
    if period == 'week':
        start = now - timedelta(days=7)
        group_by = func.date(Invoice.created_at)
    elif period == 'month':
        start = now - timedelta(days=30)
        group_by = func.date(Invoice.created_at)
    else:
        start = now - timedelta(days=365)
        group_by = func.to_char(Invoice.created_at, 'YYYY-MM')

    q = db.session.query(
        group_by.label('period'),
        func.sum(Invoice.total_amount).label('sales'),
        func.count(Invoice.id).label('count')
    ).filter(
        Invoice.tenant_id == tenant_id,
        Invoice.status != 'cancelled',
        Invoice.created_at >= start,
        Invoice.reset_batch_id.is_(None),
    )
    if outlet_id:
        q = q.filter(Invoice.outlet_id == outlet_id)

    results = q.group_by(group_by).order_by(group_by).all()

    return jsonify([{
        'period': str(r.period),
        'sales': float(r.sales or 0),
        'count': r.count,
    } for r in results])


@dashboard_bp.route('/top-products', methods=['GET'])
@jwt_required()
@tenant_required
def get_top_products():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    limit = request.args.get('limit', 10, type=int)
    days = request.args.get('days', 30, type=int)

    from app.models.billing import InvoiceItem
    start = datetime.utcnow() - timedelta(days=days) + IST_OFFSET

    q = db.session.query(
        InvoiceItem.product_name,
        func.sum(InvoiceItem.quantity).label('qty'),
        func.sum(InvoiceItem.total_amount).label('revenue'),
    ).join(Invoice, Invoice.id == InvoiceItem.invoice_id).filter(
        Invoice.tenant_id == tenant_id,
        Invoice.status != 'cancelled',
        Invoice.created_at >= start,
        Invoice.reset_batch_id.is_(None),
    )
    if outlet_id:
        q = q.filter(Invoice.outlet_id == outlet_id)

    results = q.group_by(InvoiceItem.product_name).order_by(
        func.sum(InvoiceItem.total_amount).desc()
    ).limit(limit).all()

    return jsonify([{
        'product_name': r.product_name,
        'quantity': float(r.qty or 0),
        'revenue': float(r.revenue or 0),
    } for r in results])


@dashboard_bp.route('/outlet-comparison', methods=['GET'])
@jwt_required()
@tenant_required
def get_outlet_comparison():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    days = request.args.get('days', 30, type=int)
    start = datetime.utcnow() - timedelta(days=days) + IST_OFFSET

    results = db.session.query(
        Invoice.outlet_id,
        Outlet.name.label('outlet_name'),
        func.sum(Invoice.total_amount).label('sales'),
        func.count(Invoice.id).label('bills'),
    ).join(Outlet, Outlet.id == Invoice.outlet_id).filter(
        Invoice.tenant_id == tenant_id,
        Invoice.status != 'cancelled',
        Invoice.created_at >= start,
        Invoice.reset_batch_id.is_(None),
    ).group_by(Invoice.outlet_id, Outlet.name).all()

    return jsonify([{
        'outlet_id': r.outlet_id,
        'outlet_name': r.outlet_name,
        'sales': float(r.sales or 0),
        'bills': r.bills,
    } for r in results])


@dashboard_bp.route('/daily', methods=['GET'])
@jwt_required()
@tenant_required
def get_daily_summary():
    from datetime import date as date_type
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    date_str = request.args.get('date', ist_today())

    dt_from = parse_ist_date(date_str)
    dt_to = parse_ist_date_end(date_str)
    exp_date = date_type.fromisoformat(date_str)

    # ── Sales ──────────────────────────────────────────────────────
    inv_q = Invoice.query.filter(
        Invoice.tenant_id == tenant_id,
        Invoice.status != 'cancelled',
        Invoice.created_at >= dt_from,
        Invoice.created_at < dt_to,
        Invoice.reset_batch_id.is_(None),
    )
    if outlet_id:
        inv_q = inv_q.filter(Invoice.outlet_id == outlet_id)
    invoices = inv_q.all()

    total_revenue = sum(float(i.total_amount) for i in invoices)
    by_type = {}
    for inv in invoices:
        t = inv.billing_type or 'counter'
        by_type[t] = by_type.get(t, 0) + 1

    pay_q = db.session.query(
        BillPayment.payment_mode,
        func.sum(BillPayment.amount).label('total'),
        func.count(BillPayment.id).label('cnt'),
    ).join(Invoice, Invoice.id == BillPayment.invoice_id).filter(
        BillPayment.tenant_id == tenant_id,
        Invoice.status != 'cancelled',
        Invoice.created_at >= dt_from,
        Invoice.created_at < dt_to,
        Invoice.reset_batch_id.is_(None),
    )
    if outlet_id:
        pay_q = pay_q.filter(BillPayment.outlet_id == outlet_id)
    payment_modes = sorted([{
        'mode': r.payment_mode,
        'total': float(r.total or 0),
        'count': r.cnt,
    } for r in pay_q.group_by(BillPayment.payment_mode).all()], key=lambda x: -x['total'])

    # ── Purchases recorded today ────────────────────────────────────
    pur_q = Purchase.query.filter(
        Purchase.tenant_id == tenant_id,
        Purchase.created_at >= dt_from,
        Purchase.created_at < dt_to,
        Purchase.reset_batch_id.is_(None),
    )
    if outlet_id:
        pur_q = pur_q.filter(Purchase.outlet_id == outlet_id)
    todays_purchases = pur_q.all()

    received = [p for p in todays_purchases if p.status == 'received']
    cancelled_today = [p for p in todays_purchases if p.status == 'cancelled']

    # All currently pending purchases (any date) for this tenant/outlet
    pending_q = Purchase.query.filter(
        Purchase.tenant_id == tenant_id,
        Purchase.status == 'pending',
        Purchase.reset_batch_id.is_(None),
    )
    if outlet_id:
        pending_q = pending_q.filter(Purchase.outlet_id == outlet_id)
    all_pending = pending_q.order_by(Purchase.created_at.asc()).all()

    from app.models.product import Product as ProductModel

    def pur_summary(p):
        items = p.items.all()
        # Resolve current product names so renames are reflected
        pid_set = {item.product_id for item in items}
        name_map = {}
        if pid_set:
            rows = ProductModel.query.filter(
                ProductModel.id.in_(pid_set)
            ).with_entities(ProductModel.id, ProductModel.name).all()
            name_map = {r.id: r.name for r in rows}

        return {
            'purchase_number': p.purchase_number,
            'supplier_name': p.supplier.name if p.supplier else None,
            'invoice_number': p.invoice_number,
            'invoice_date': p.invoice_date.isoformat() if p.invoice_date else None,
            'total_amount': float(p.total_amount),
            'items_count': len(items),
            'items': [
                {
                    'product_name': name_map.get(item.product_id) or item.product_name,
                    'quantity': float(item.quantity),
                    'unit': item.unit or 'pcs',
                    'unit_cost': float(item.unit_cost),
                    'total': float(item.total_cost),
                }
                for item in items
            ],
        }

    # ── Expenses ───────────────────────────────────────────────────
    exp_q = Expense.query.filter(
        Expense.tenant_id == tenant_id,
        Expense.status == 'approved',
        Expense.expense_date == exp_date,
        Expense.reset_batch_id.is_(None),
    )
    if outlet_id:
        exp_q = exp_q.filter(Expense.outlet_id == outlet_id)
    expenses = exp_q.all()

    # ── Product movements ──────────────────────────────────────────
    # Group by product_id only so renamed products aren't split into
    # separate rows (old name vs new name both share the same product_id).
    pur_items_q = db.session.query(
        PurchaseItem.product_id,
        func.max(PurchaseItem.product_name).label('product_name'),
        func.sum(PurchaseItem.quantity).label('qty'),
    ).join(Purchase, Purchase.id == PurchaseItem.purchase_id).filter(
        Purchase.tenant_id == tenant_id,
        Purchase.status == 'received',
        Purchase.created_at >= dt_from,
        Purchase.created_at < dt_to,
        Purchase.reset_batch_id.is_(None),
    )
    if outlet_id:
        pur_items_q = pur_items_q.filter(Purchase.outlet_id == outlet_id)
    purchased_map = {
        row.product_id: {'name': row.product_name, 'qty': float(row.qty or 0)}
        for row in pur_items_q.group_by(PurchaseItem.product_id).all()
    }

    # Quantities sold today (non-cancelled invoices)
    sold_items_q = db.session.query(
        InvoiceItem.product_id,
        func.max(InvoiceItem.product_name).label('product_name'),
        func.sum(InvoiceItem.quantity).label('qty'),
    ).join(Invoice, Invoice.id == InvoiceItem.invoice_id).filter(
        Invoice.tenant_id == tenant_id,
        Invoice.status != 'cancelled',
        Invoice.created_at >= dt_from,
        Invoice.created_at < dt_to,
        Invoice.reset_batch_id.is_(None),
    )
    if outlet_id:
        sold_items_q = sold_items_q.filter(Invoice.outlet_id == outlet_id)
    sold_map = {
        row.product_id: {'name': row.product_name, 'qty': float(row.qty or 0)}
        for row in sold_items_q.group_by(InvoiceItem.product_id).all()
    }

    # Merge: every product purchased or sold today.
    # Prefer the current product name from the Product table so renames
    # are reflected immediately rather than showing stale stored names.
    all_product_ids = set(purchased_map) | set(sold_map)
    current_names = {}
    if all_product_ids:
        from app.models.product import Product as ProductModel
        rows = ProductModel.query.filter(
            ProductModel.id.in_(all_product_ids)
        ).with_entities(ProductModel.id, ProductModel.name).all()
        current_names = {r.id: r.name for r in rows}

    movements = []
    for pid in all_product_ids:
        p = purchased_map.get(pid, {})
        s = sold_map.get(pid, {})
        qty_in = p.get('qty', 0)
        qty_out = s.get('qty', 0)
        # Use current product name; fall back to whatever was stored in the line item
        display_name = current_names.get(pid) or p.get('name') or s.get('name', 'Unknown')
        movements.append({
            'product_id': pid,
            'product_name': display_name,
            'qty_purchased': qty_in,
            'qty_sold': qty_out,
            'net': round(qty_in - qty_out, 3),
        })
    movements.sort(key=lambda x: (-x['qty_sold'], x['product_name']))

    return jsonify({
        'date': date_str,
        'sales': {
            'total_bills': len(invoices),
            'total_revenue': total_revenue,
            'tax_collected': sum(float(i.tax_amount) for i in invoices),
            'discount_given': sum(float(i.discount_amount) for i in invoices),
            'avg_bill': round(total_revenue / len(invoices), 2) if invoices else 0,
            'by_type': by_type,
            'payment_modes': payment_modes,
        },
        'stock_received': {
            'count': len(received),
            'total_amount': sum(float(p.total_amount) for p in received),
            'purchases': [pur_summary(p) for p in received],
        },
        'stock_pending': {
            'count': len(all_pending),
            'total_amount': sum(float(p.total_amount) for p in all_pending),
            'purchases': [pur_summary(p) for p in all_pending],
        },
        'expenses': {
            'count': len(expenses),
            'total_amount': sum(float(e.amount) for e in expenses),
            'items': [{
                'description': e.description,
                'category': e.category,
                'amount': float(e.amount),
                'payment_mode': e.payment_mode,
            } for e in expenses],
        },
        'product_movements': movements,
    })

