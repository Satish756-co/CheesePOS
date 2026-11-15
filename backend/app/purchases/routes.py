from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import date
from decimal import Decimal
from app.extensions import db
from app.models import (
    Purchase, PurchaseItem, Supplier,
    StockBalance, InventoryLedger, Product
)
from app.auth.decorators import tenant_required

purchases_bp = Blueprint('purchases', __name__)


def _apply_inventory(purchase, user_id, received_qtys=None):
    """Credit inventory for items in a purchase.
    received_qtys: optional dict {item_id: qty} for partial receipts.
    If None, full quantities are used.
    """
    for item in purchase.items.all():
        qty = item.quantity
        if received_qtys is not None:
            # Use explicit key check — avoid 'or' which treats 0 as falsy
            key = str(item.id)
            if key in received_qtys:
                qty = Decimal(str(received_qtys[key]))
            elif item.id in received_qtys:
                qty = Decimal(str(received_qtys[item.id]))
            if qty <= 0:
                continue

        stock = StockBalance.query.filter_by(
            outlet_id=purchase.outlet_id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            tenant_id=purchase.tenant_id,
            reset_batch_id=None,
        ).first()
        if not stock:
            # Clear any soft-deleted stub so the unique constraint allows a fresh row
            StockBalance.query.filter(
                StockBalance.outlet_id == purchase.outlet_id,
                StockBalance.product_id == item.product_id,
                StockBalance.variant_id == item.variant_id,
                StockBalance.tenant_id == purchase.tenant_id,
                StockBalance.reset_batch_id.isnot(None),
            ).delete(synchronize_session=False)
            stock = StockBalance(
                tenant_id=purchase.tenant_id,
                outlet_id=purchase.outlet_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                current_stock=Decimal('0'),
                avg_cost=Decimal('0'),
            )
            db.session.add(stock)
            db.session.flush()

        old_qty = Decimal(str(stock.current_stock))
        stock.current_stock += qty
        if old_qty > 0:
            old_cost = Decimal(str(stock.avg_cost or 0))
            stock.avg_cost = (old_qty * old_cost + qty * item.unit_cost) / (old_qty + qty)
        else:
            stock.avg_cost = item.unit_cost

        ledger = InventoryLedger(
            tenant_id=purchase.tenant_id,
            outlet_id=purchase.outlet_id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            transaction_type='purchase',
            reference_type='purchase',
            reference_id=purchase.id,
            quantity_in=item.quantity,
            balance=stock.current_stock,
            unit_cost=item.unit_cost,
            created_by=user_id,
        )
        db.session.add(ledger)


@purchases_bp.route('/suppliers', methods=['GET'])
@jwt_required()
@tenant_required
def list_suppliers():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    suppliers = Supplier.query.filter_by(tenant_id=tenant_id, is_active=True).all()
    return jsonify([s.to_dict() for s in suppliers])


@purchases_bp.route('/suppliers', methods=['POST'])
@jwt_required()
@tenant_required
def create_supplier():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    data = request.get_json()

    if not data or not data.get('name'):
        return jsonify({'error': 'Supplier name is required'}), 400

    count = Supplier.query.filter_by(tenant_id=tenant_id).count()
    supplier = Supplier(
        tenant_id=tenant_id,
        supplier_code=f"SUP-{str(count + 1).zfill(4)}",
        name=data['name'],
        contact_person=data.get('contact_person'),
        phone=data.get('phone'),
        email=data.get('email'),
        address=data.get('address'),
        gstin=data.get('gstin'),
        payment_terms=data.get('payment_terms', 30),
    )
    db.session.add(supplier)
    db.session.commit()
    return jsonify(supplier.to_dict()), 201


@purchases_bp.route('/', methods=['GET'])
@jwt_required()
@tenant_required
def list_purchases():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    include_items = request.args.get('include_items') == 'true'
    page = request.args.get('page', 1, type=int)

    q = Purchase.query.filter_by(tenant_id=tenant_id).filter(Purchase.reset_batch_id.is_(None))
    if outlet_id:
        q = q.filter_by(outlet_id=outlet_id)

    pagination = q.order_by(Purchase.created_at.desc()).paginate(page=page, per_page=20, error_out=False)
    return jsonify({
        'purchases': [p.to_dict(include_items=include_items) for p in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
    })


@purchases_bp.route('/<int:purchase_id>', methods=['GET'])
@jwt_required()
@tenant_required
def get_purchase(purchase_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    purchase = Purchase.query.filter_by(id=purchase_id, tenant_id=tenant_id).filter(Purchase.reset_batch_id.is_(None)).first_or_404()
    return jsonify(purchase.to_dict(include_items=True))


@purchases_bp.route('/<int:purchase_id>', methods=['PATCH'])
@jwt_required()
@tenant_required
def update_purchase(purchase_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    purchase = Purchase.query.filter_by(id=purchase_id, tenant_id=tenant_id).filter(Purchase.reset_batch_id.is_(None)).first_or_404()
    data = request.get_json()

    new_status = data.get('status')
    paid_amount = data.get('paid_amount')
    received_items = data.get('received_items')  # dict {item_id: qty} for partial receipt

    # Delivery status change
    if new_status and new_status != purchase.status:
        if purchase.status == 'received':
            return jsonify({'error': 'Cannot change status of a received purchase'}), 400
        if new_status not in ('received', 'cancelled'):
            return jsonify({'error': 'Invalid status'}), 400

        purchase.status = new_status

        if new_status == 'received':
            _apply_inventory(purchase, user_id, received_qtys=received_items)
            # Recalculate total and balance based on what was actually received
            if received_items:
                received_subtotal = Decimal('0')
                for item in purchase.items.all():
                    key = str(item.id)
                    if key in received_items:
                        rcv_qty = Decimal(str(received_items[key]))
                    elif item.id in received_items:
                        rcv_qty = Decimal(str(received_items[item.id]))
                    else:
                        rcv_qty = item.quantity
                    if rcv_qty > 0:
                        received_subtotal += rcv_qty * item.unit_cost
                purchase.subtotal = received_subtotal
                purchase.total_amount = received_subtotal + (purchase.tax_amount or Decimal('0'))
                purchase.balance_amount = max(purchase.total_amount - (purchase.paid_amount or Decimal('0')), Decimal('0'))
                if purchase.paid_amount >= purchase.total_amount:
                    purchase.payment_status = 'paid'
                elif (purchase.paid_amount or Decimal('0')) > 0:
                    purchase.payment_status = 'partial'
                else:
                    purchase.payment_status = 'unpaid'

        elif new_status == 'cancelled':
            # Nothing arrived — no inventory update, clear balance
            purchase.balance_amount = Decimal('0')
            if (purchase.paid_amount or Decimal('0')) == 0:
                purchase.payment_status = 'unpaid'

    # Payment update
    if paid_amount is not None:
        purchase.paid_amount = Decimal(str(paid_amount))
        purchase.balance_amount = max(purchase.total_amount - purchase.paid_amount, Decimal('0'))
        if purchase.paid_amount >= purchase.total_amount:
            purchase.payment_status = 'paid'
        elif purchase.paid_amount > 0:
            purchase.payment_status = 'partial'
        else:
            purchase.payment_status = 'unpaid'

    db.session.commit()
    return jsonify(purchase.to_dict(include_items=True))


@purchases_bp.route('/', methods=['POST'])
@jwt_required()
@tenant_required
def create_purchase():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data or not data.get('outlet_id') or not data.get('supplier_id'):
        return jsonify({'error': 'outlet_id and supplier_id are required'}), 400

    # User can choose to receive immediately or record as pending
    arrival_status = data.get('status', 'received')  # 'received' or 'pending'
    if arrival_status not in ('received', 'pending'):
        arrival_status = 'received'

    paid_amount = Decimal(str(data.get('paid_amount', 0)))

    count = Purchase.query.filter_by(tenant_id=tenant_id).count()
    purchase_number = f"PUR-{str(count + 1).zfill(6)}"

    items_data = data.get('items', [])
    subtotal = sum(Decimal(str(i['quantity'])) * Decimal(str(i['unit_cost'])) for i in items_data)
    tax_amount = Decimal(str(data.get('tax_amount', 0)))
    total_amount = subtotal + tax_amount
    balance_amount = max(total_amount - paid_amount, Decimal('0'))

    if paid_amount >= total_amount:
        payment_status = 'paid'
    elif paid_amount > 0:
        payment_status = 'partial'
    else:
        payment_status = 'unpaid'

    purchase = Purchase(
        tenant_id=tenant_id,
        outlet_id=data['outlet_id'],
        supplier_id=data['supplier_id'],
        purchase_number=purchase_number,
        invoice_number=data.get('invoice_number'),
        invoice_date=date.fromisoformat(data['invoice_date']) if data.get('invoice_date') else date.today(),
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        paid_amount=paid_amount,
        balance_amount=balance_amount,
        status=arrival_status,
        payment_status=payment_status,
        received_by=user_id,
    )
    db.session.add(purchase)
    db.session.flush()

    for item_data in items_data:
        if not item_data.get('product_id') or item_data.get('quantity') is None or item_data.get('unit_cost') is None:
            continue
        product = Product.query.filter_by(id=item_data['product_id'], tenant_id=tenant_id).first()
        if not product:
            continue
        qty = Decimal(str(item_data['quantity']))
        unit_cost = Decimal(str(item_data['unit_cost']))
        if qty <= 0:
            return jsonify({'error': 'Item quantity must be greater than zero'}), 400
        if unit_cost < 0:
            return jsonify({'error': 'Item unit cost cannot be negative'}), 400
        purchase_item = PurchaseItem(
            purchase_id=purchase.id,
            product_id=product.id,
            variant_id=item_data.get('variant_id'),
            product_name=product.name,
            quantity=qty,
            unit_cost=unit_cost,
            total_cost=qty * unit_cost,
        )
        db.session.add(purchase_item)

    db.session.flush()

    # Update inventory only if received now
    if arrival_status == 'received':
        _apply_inventory(purchase, user_id)

    db.session.commit()
    return jsonify(purchase.to_dict(include_items=True)), 201
