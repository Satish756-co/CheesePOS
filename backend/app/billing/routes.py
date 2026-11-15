from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import datetime, date, timedelta
from app.utils import parse_ist_date, parse_ist_date_end
from app.extensions import db, limiter
from decimal import Decimal
import uuid
from app.extensions import db
from app.models import (
    Invoice, InvoiceItem, BillPayment, Order, OrderItem,
    Product, ProductVariant, StockBalance, InventoryLedger, Outlet
)
from app.auth.decorators import tenant_required, permission_required
from app.auth.routes import log_audit

billing_bp = Blueprint('billing', __name__)


def calculate_tax(amount, tax_category, state='AP'):
    tax_rates = {
        'gst_0': 0,
        'gst_5': 5,
        'gst_12': 12,
        'gst_18': 18,
        'gst_28': 28,
        'liquor_ap': 0,  # AP uses state excise, no GST on liquor
        'exempt': 0,
    }
    rate = tax_rates.get(tax_category, 0)
    return Decimal(str(amount)) * Decimal(str(rate)) / 100, rate


@billing_bp.route('/create', methods=['POST'])
@limiter.limit("120 per minute")
@jwt_required()
@tenant_required
def create_invoice():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    data = request.get_json()

    # Idempotency check
    idempotency_key = data.get('idempotency_key')
    if idempotency_key:
        existing = Invoice.query.filter_by(idempotency_key=idempotency_key).filter(Invoice.reset_batch_id.is_(None)).first()
        if existing:
            return jsonify(existing.to_dict(include_items=True)), 200

    outlet = Outlet.query.filter_by(id=data.get('outlet_id'), tenant_id=tenant_id).first()
    if not outlet:
        return jsonify({'error': 'Outlet not found'}), 404

    items_data = data.get('items', [])
    if not items_data:
        return jsonify({'error': 'No items in invoice'}), 400

    # Generate invoice number
    today = date.today()
    count = Invoice.query.filter(
        Invoice.outlet_id == outlet.id,
        db.func.date(Invoice.created_at) == today
    ).count()
    invoice_number = f"{outlet.outlet_code}-{today.strftime('%Y%m%d')}-{str(count + 1).zfill(4)}"

    subtotal = Decimal('0')
    total_taxable = Decimal('0')
    total_tax = Decimal('0')
    tax_breakdown = {}
    invoice_items = []

    for item_data in items_data:
        if not item_data.get('product_id'):
            return jsonify({'error': 'Each item must have a product_id'}), 400
        product = Product.query.filter_by(id=item_data['product_id'], tenant_id=tenant_id).first()
        if not product:
            return jsonify({'error': f"Product {item_data['product_id']} not found"}), 404

        variant = None
        unit_price = Decimal(str(product.selling_price))
        if item_data.get('variant_id'):
            variant = db.session.get(ProductVariant, item_data['variant_id'])
            if variant:
                unit_price = Decimal(str(variant.selling_price))

        qty = Decimal(str(item_data.get('quantity', 1)))
        if qty <= 0:
            return jsonify({'error': 'Item quantity must be greater than zero'}), 400
        discount_pct = Decimal(str(item_data.get('discount_percent', 0)))
        if not (0 <= discount_pct <= 100):
            return jsonify({'error': 'Discount percent must be between 0 and 100'}), 400
        item_subtotal = qty * unit_price
        discount_amt = item_subtotal * discount_pct / 100
        taxable = item_subtotal - discount_amt

        tax_category = product.tax_category or 'gst_0'
        tax_amt, tax_rate = calculate_tax(float(taxable), tax_category)

        if tax_category not in tax_breakdown:
            tax_breakdown[tax_category] = {'rate': tax_rate, 'amount': 0}
        tax_breakdown[tax_category]['amount'] += float(tax_amt)

        item_total = taxable + tax_amt
        subtotal += item_subtotal
        total_taxable += taxable
        total_tax += tax_amt

        invoice_items.append(InvoiceItem(
            product_id=product.id,
            variant_id=variant.id if variant else None,
            product_name=f"{product.name} {variant.variant_name if variant else ''}".strip(),
            variant_name=variant.variant_name if variant else None,
            hsn_code=product.hsn_code,
            quantity=qty,
            unit_price=unit_price,
            discount_percent=discount_pct,
            discount_amount=discount_amt,
            taxable_amount=taxable,
            tax_category=tax_category,
            tax_rate=Decimal(str(tax_rate)),
            tax_amount=tax_amt,
            total_amount=item_total,
        ))

    discount_amount = Decimal(str(data.get('discount_amount', 0)))
    service_charge = Decimal(str(data.get('service_charge', 0)))
    taxable_amount = total_taxable - discount_amount
    total_before_round = taxable_amount + total_tax + service_charge
    round_off = round(total_before_round) - total_before_round
    total_amount = total_before_round + round_off

    invoice = Invoice(
        tenant_id=tenant_id,
        outlet_id=outlet.id,
        invoice_number=invoice_number,
        order_id=data.get('order_id'),
        billing_type=data.get('billing_type', 'counter'),
        customer_name=data.get('customer_name'),
        customer_phone=data.get('customer_phone'),
        cashier_id=user_id,
        subtotal=subtotal,
        discount_amount=discount_amount,
        taxable_amount=taxable_amount,
        tax_breakdown=tax_breakdown,
        tax_amount=total_tax,
        service_charge=service_charge,
        round_off=round_off,
        total_amount=total_amount,
        status='paid',
        payment_status='pending',
        idempotency_key=idempotency_key,
    )
    db.session.add(invoice)
    db.session.flush()

    for item in invoice_items:
        item.invoice_id = invoice.id
        db.session.add(item)

    # Process payments
    payments_data = data.get('payments', [])
    paid_amount = Decimal('0')
    for pmt in payments_data:
        payment = BillPayment(
            invoice_id=invoice.id,
            tenant_id=tenant_id,
            outlet_id=outlet.id,
            payment_mode=pmt['payment_mode'],
            amount=Decimal(str(pmt['amount'])),
            reference_number=pmt.get('reference_number'),
        )
        db.session.add(payment)
        paid_amount += Decimal(str(pmt['amount']))

    invoice.paid_amount = paid_amount
    invoice.change_amount = max(paid_amount - total_amount, Decimal('0'))
    invoice.payment_status = 'paid' if paid_amount >= total_amount else 'partial'

    # Deduct inventory — only for counter billing (no order_id).
    # Table orders already deducted inventory when the order was placed.
    if not data.get('order_id'):
        for item_data, inv_item in zip(items_data, invoice_items):
            stock = StockBalance.query.filter_by(
                outlet_id=outlet.id,
                product_id=inv_item.product_id,
                variant_id=inv_item.variant_id,
                reset_batch_id=None,
            ).first()
            if stock:
                stock.current_stock -= inv_item.quantity
                ledger = InventoryLedger(
                    tenant_id=tenant_id,
                    outlet_id=outlet.id,
                    product_id=inv_item.product_id,
                    variant_id=inv_item.variant_id,
                    transaction_type='sale',
                    reference_type='invoice',
                    reference_id=invoice.id,
                    quantity_out=inv_item.quantity,
                    balance=stock.current_stock,
                    created_by=user_id,
                )
                db.session.add(ledger)

    # If linked to an order, mark it as billed and release the table
    order_id = data.get('order_id')
    if order_id:
        linked_order = Order.query.filter_by(id=order_id, tenant_id=tenant_id).filter(Order.reset_batch_id.is_(None)).first()
        if linked_order:
            linked_order.status = 'billed'
            linked_order.invoice_id = invoice.id
            if linked_order.table_id:
                from app.models.outlet import TableMaster
                table = db.session.get(TableMaster, linked_order.table_id)
                if table:
                    table.status = 'available'
                    table.current_order_id = None

    db.session.commit()
    return jsonify(invoice.to_dict(include_items=True)), 201


@billing_bp.route('/invoices', methods=['GET'])
@jwt_required()
@tenant_required
def list_invoices():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    billing_type = request.args.get('billing_type')
    status = request.args.get('status')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    q = Invoice.query.filter_by(tenant_id=tenant_id).filter(Invoice.reset_batch_id.is_(None))
    if outlet_id:
        q = q.filter_by(outlet_id=outlet_id)
    if billing_type:
        q = q.filter_by(billing_type=billing_type)
    if status:
        q = q.filter_by(status=status)
    if date_from:
        q = q.filter(Invoice.created_at >= parse_ist_date(date_from))
    if date_to:
        q = q.filter(Invoice.created_at < parse_ist_date_end(date_to))

    pagination = q.order_by(Invoice.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'invoices': [i.to_dict() for i in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page,
    })


@billing_bp.route('/invoice/<int:invoice_id>', methods=['GET'])
@jwt_required()
@tenant_required
def get_invoice(invoice_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    invoice = Invoice.query.filter_by(id=invoice_id, tenant_id=tenant_id).filter(Invoice.reset_batch_id.is_(None)).first_or_404()
    return jsonify(invoice.to_dict(include_items=True))


@billing_bp.route('/invoice/<int:invoice_id>/cancel', methods=['POST'])
@limiter.limit("30 per minute")
@jwt_required()
@tenant_required
def cancel_invoice(invoice_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    invoice = Invoice.query.filter_by(id=invoice_id, tenant_id=tenant_id).filter(Invoice.reset_batch_id.is_(None)).first_or_404()

    if invoice.status == 'cancelled':
        return jsonify({'error': 'Invoice already cancelled'}), 400

    data = request.get_json()
    reason = data.get('reason', '').strip()
    if not reason:
        return jsonify({'error': 'Cancellation reason required'}), 400

    invoice.status = 'cancelled'
    invoice.cancelled_at = datetime.utcnow()
    invoice.cancelled_by = user_id
    invoice.cancellation_reason = reason

    log_audit(user_id, 'invoice.cancelled', tenant_id=tenant_id, resource_type='invoice', resource_id=invoice_id,
              new={'reason': reason, 'invoice_number': invoice.invoice_number})
    db.session.commit()
    return jsonify({'message': 'Invoice cancelled', 'invoice': invoice.to_dict()})
