from datetime import date as date_type
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import func
from app.extensions import db
from app.models import Invoice, InvoiceItem, Expense, StockBalance, Product, Outlet, BillPayment, Purchase
from app.auth.decorators import tenant_required
from app.utils import ist_today, ist_days_ago, parse_ist_date, parse_ist_date_end

reports_bp = Blueprint('reports', __name__)


@reports_bp.route('/sales', methods=['GET'])
@jwt_required()
@tenant_required
def sales_report():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    date_from = request.args.get('date_from', ist_days_ago(30))
    date_to = request.args.get('date_to', ist_today())

    dt_from = parse_ist_date(date_from)
    dt_to = parse_ist_date_end(date_to)

    q = Invoice.query.filter(
        Invoice.tenant_id == tenant_id,
        Invoice.status != 'cancelled',
        Invoice.created_at >= dt_from,
        Invoice.created_at < dt_to,
        Invoice.reset_batch_id.is_(None),
    )
    if outlet_id:
        q = q.filter(Invoice.outlet_id == outlet_id)

    invoices = q.all()
    total_sales = sum(float(i.total_amount) for i in invoices)
    total_tax = sum(float(i.tax_amount) for i in invoices)
    total_discount = sum(float(i.discount_amount) for i in invoices)
    total_bills = len(invoices)

    daily = {}
    for inv in invoices:
        # Convert UTC stored time back to IST date label for daily grouping
        from app.utils import IST_OFFSET
        ist_dt = inv.created_at + IST_OFFSET
        d = ist_dt.strftime('%Y-%m-%d')
        if d not in daily:
            daily[d] = {'date': d, 'sales': 0, 'bills': 0}
        daily[d]['sales'] += float(inv.total_amount)
        daily[d]['bills'] += 1

    return jsonify({
        'summary': {
            'total_sales': total_sales,
            'total_tax': total_tax,
            'total_discount': total_discount,
            'total_bills': total_bills,
            'avg_bill_value': total_sales / total_bills if total_bills else 0,
        },
        'daily': sorted(daily.values(), key=lambda x: x['date']),
        'date_from': date_from,
        'date_to': date_to,
    })


@reports_bp.route('/product-sales', methods=['GET'])
@jwt_required()
@tenant_required
def product_sales_report():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    date_from = request.args.get('date_from', ist_days_ago(30))
    date_to = request.args.get('date_to', ist_today())

    dt_from = parse_ist_date(date_from)
    dt_to = parse_ist_date_end(date_to)

    q = db.session.query(
        InvoiceItem.product_name,
        InvoiceItem.variant_name,
        func.sum(InvoiceItem.quantity).label('total_qty'),
        func.sum(InvoiceItem.total_amount).label('total_revenue'),
        func.count(InvoiceItem.id).label('order_count'),
    ).join(Invoice, Invoice.id == InvoiceItem.invoice_id).filter(
        Invoice.tenant_id == tenant_id,
        Invoice.status != 'cancelled',
        Invoice.created_at >= dt_from,
        Invoice.created_at < dt_to,
        Invoice.reset_batch_id.is_(None),
    )
    if outlet_id:
        q = q.filter(Invoice.outlet_id == outlet_id)

    results = q.group_by(InvoiceItem.product_name, InvoiceItem.variant_name).order_by(
        func.sum(InvoiceItem.total_amount).desc()
    ).all()

    return jsonify([{
        'product_name': r.product_name,
        'variant_name': r.variant_name,
        'total_qty': float(r.total_qty or 0),
        'total_revenue': float(r.total_revenue or 0),
        'order_count': r.order_count,
    } for r in results])


@reports_bp.route('/payment-modes', methods=['GET'])
@jwt_required()
@tenant_required
def payment_modes_report():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    date_from = request.args.get('date_from', ist_today())
    date_to = request.args.get('date_to', ist_today())

    dt_from = parse_ist_date(date_from)
    dt_to = parse_ist_date_end(date_to)

    q = db.session.query(
        BillPayment.payment_mode,
        func.sum(BillPayment.amount).label('total'),
        func.count(BillPayment.id).label('count'),
    ).join(Invoice, Invoice.id == BillPayment.invoice_id).filter(
        BillPayment.tenant_id == tenant_id,
        Invoice.status != 'cancelled',
        Invoice.created_at >= dt_from,
        Invoice.created_at < dt_to,
        Invoice.reset_batch_id.is_(None),
    )
    if outlet_id:
        q = q.filter(BillPayment.outlet_id == outlet_id)

    results = q.group_by(BillPayment.payment_mode).all()

    return jsonify([{
        'mode': r.payment_mode,
        'total': float(r.total or 0),
        'count': r.count,
    } for r in results])


@reports_bp.route('/profit-loss', methods=['GET'])
@jwt_required()
@tenant_required
def profit_loss_report():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    date_from = request.args.get('date_from', ist_days_ago(30))
    date_to = request.args.get('date_to', ist_today())

    dt_from = parse_ist_date(date_from)
    dt_to = parse_ist_date_end(date_to)
    # expense_date is stored as a plain IST date — compare directly against the string
    exp_from = date_type.fromisoformat(date_from)
    exp_to = date_type.fromisoformat(date_to)

    # Revenue from invoices
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
    gross_revenue = sum(float(i.total_amount) for i in invoices)
    total_tax = sum(float(i.tax_amount) for i in invoices)
    total_discount = sum(float(i.discount_amount) for i in invoices)
    net_revenue = gross_revenue - total_tax

    # Stock purchases (COGS) — only count fully received purchases; pending/approved/cancelled do not affect P&L
    purchase_q = Purchase.query.filter(
        Purchase.tenant_id == tenant_id,
        Purchase.status == 'received',
        Purchase.created_at >= dt_from,
        Purchase.created_at < dt_to,
        Purchase.reset_batch_id.is_(None),
    )
    if outlet_id:
        purchase_q = purchase_q.filter(Purchase.outlet_id == outlet_id)

    purchases = purchase_q.all()
    total_purchases = sum(float(p.total_amount) for p in purchases)
    total_purchases_tax = sum(float(p.tax_amount) for p in purchases)

    gross_profit = net_revenue - total_purchases

    # Operating expenses — expense_date is IST plain date
    expense_q = Expense.query.filter(
        Expense.tenant_id == tenant_id,
        Expense.status == 'approved',
        Expense.expense_date >= exp_from,
        Expense.expense_date <= exp_to,
        Expense.reset_batch_id.is_(None),
    )
    if outlet_id:
        expense_q = expense_q.filter(Expense.outlet_id == outlet_id)

    expenses = expense_q.all()
    total_expenses = sum(float(e.amount) for e in expenses)

    expense_by_category = {}
    for e in expenses:
        cat = e.category or 'other'
        expense_by_category[cat] = expense_by_category.get(cat, 0) + float(e.amount)
    expense_breakdown = [{'category': k, 'amount': v} for k, v in sorted(expense_by_category.items())]

    net_profit = gross_profit - total_expenses
    profit_margin = (net_profit / net_revenue * 100) if net_revenue else 0

    return jsonify({
        'gross_revenue': gross_revenue,
        'tax_collected': total_tax,
        'total_discount': total_discount,
        'net_revenue': net_revenue,
        'total_purchases': total_purchases,
        'total_purchases_tax': total_purchases_tax,
        'gross_profit': gross_profit,
        'total_expenses': total_expenses,
        'expense_breakdown': expense_breakdown,
        'net_profit': net_profit,
        'profit_margin': profit_margin,
        'date_from': date_from,
        'date_to': date_to,
    })
