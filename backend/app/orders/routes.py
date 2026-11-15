from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import datetime
from decimal import Decimal
from app.extensions import db
from app.models import (
    Order, OrderItem, KOT, KOTItem, TableMaster, Product, ProductVariant,
    StockBalance, InventoryLedger,
)
from app.auth.decorators import tenant_required
from app.utils import parse_ist_date, parse_ist_date_end

orders_bp = Blueprint('orders', __name__)

ALL_ORDERS_ROLES = {'owner', 'admin', 'accountant', 'manager', 'super_admin'}


def _deduct_inventory(outlet_id, tenant_id, product_id, variant_id, quantity, user_id, reference_id):
    stock = StockBalance.query.filter_by(
        outlet_id=outlet_id,
        tenant_id=tenant_id,
        product_id=product_id,
        variant_id=variant_id,
        reset_batch_id=None,
    ).first()
    if not stock:
        return
    stock.current_stock -= Decimal(str(quantity))
    ledger = InventoryLedger(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        product_id=product_id,
        variant_id=variant_id,
        transaction_type='sale',
        reference_type='order',
        reference_id=reference_id,
        quantity_out=Decimal(str(quantity)),
        balance=stock.current_stock,
        created_by=user_id,
    )
    db.session.add(ledger)


def _restore_inventory(outlet_id, tenant_id, product_id, variant_id, quantity, user_id, reference_id):
    stock = StockBalance.query.filter_by(
        outlet_id=outlet_id,
        tenant_id=tenant_id,
        product_id=product_id,
        variant_id=variant_id,
        reset_batch_id=None,
    ).first()
    if not stock:
        return
    stock.current_stock += Decimal(str(quantity))
    ledger = InventoryLedger(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        product_id=product_id,
        variant_id=variant_id,
        transaction_type='adjustment',
        reference_type='order_return',
        reference_id=reference_id,
        quantity_in=Decimal(str(quantity)),
        balance=stock.current_stock,
        created_by=user_id,
    )
    db.session.add(ledger)


@orders_bp.route('/', methods=['GET'])
@jwt_required()
@tenant_required
def list_orders():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    role = claims.get('role', '')

    outlet_id = request.args.get('outlet_id', type=int)
    table_id = request.args.get('table_id', type=int)
    status = request.args.get('status')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    q = Order.query.filter_by(tenant_id=tenant_id).filter(Order.reset_batch_id.is_(None))

    if role not in ALL_ORDERS_ROLES:
        q = q.filter_by(waiter_id=user_id)

    if outlet_id:
        q = q.filter_by(outlet_id=outlet_id)
    if table_id:
        q = q.filter_by(table_id=table_id)
    if status:
        q = q.filter_by(status=status)
    elif request.args.get('active_only') == '1':
        q = q.filter(Order.status.not_in(['billed', 'cancelled']))
    if date_from:
        q = q.filter(Order.created_at >= parse_ist_date(date_from))
    if date_to:
        q = q.filter(Order.created_at < parse_ist_date_end(date_to))

    orders = q.order_by(Order.created_at.desc()).limit(500).all()
    return jsonify([o.to_dict(include_items=True) for o in orders])


@orders_bp.route('/', methods=['POST'])
@jwt_required()
@tenant_required
def create_order():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data or not data.get('outlet_id'):
        return jsonify({'error': 'outlet_id is required'}), 400

    count = Order.query.filter_by(tenant_id=tenant_id, outlet_id=data['outlet_id']).count()
    order_number = f"ORD-{datetime.utcnow().strftime('%Y%m%d')}-{str(count + 1).zfill(4)}"

    order = Order(
        tenant_id=tenant_id,
        outlet_id=data['outlet_id'],
        order_number=order_number,
        table_id=data.get('table_id'),
        order_type=data.get('order_type', 'dine_in'),
        waiter_id=user_id,
        customer_name=data.get('customer_name'),
        customer_phone=data.get('customer_phone'),
        guest_count=data.get('guest_count', 1),
        notes=data.get('notes'),
    )
    db.session.add(order)
    db.session.flush()

    # Update table status
    if data.get('table_id'):
        table = db.session.get(TableMaster, data['table_id'])
        if table:
            table.status = 'occupied'
            table.current_order_id = order.id

    order_items = []
    for item_data in data.get('items', []):
        if not item_data.get('product_id'):
            continue
        product = db.session.get(Product, item_data['product_id'])
        variant = db.session.get(ProductVariant, item_data.get('variant_id')) if item_data.get('variant_id') else None
        price = Decimal(str(variant.selling_price if variant else product.selling_price))
        qty = Decimal(str(item_data.get('quantity', 1)))
        if qty <= 0:
            return jsonify({'error': 'Item quantity must be greater than zero'}), 400

        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            variant_id=variant.id if variant else None,
            product_name=f"{product.name} {variant.variant_name if variant else ''}".strip(),
            variant_name=variant.variant_name if variant else None,
            quantity=qty,
            unit_price=price,
            net_amount=qty * price,
            special_instructions=item_data.get('special_instructions'),
        )
        db.session.add(order_item)
        order_items.append(order_item)

    db.session.flush()

    # Deduct inventory immediately when order is placed
    for order_item in order_items:
        _deduct_inventory(
            outlet_id=order.outlet_id,
            tenant_id=tenant_id,
            product_id=order_item.product_id,
            variant_id=order_item.variant_id,
            quantity=order_item.quantity,
            user_id=user_id,
            reference_id=order.id,
        )

    db.session.commit()
    return jsonify(order.to_dict(include_items=True)), 201


@orders_bp.route('/<int:order_id>/status', methods=['PATCH'])
@jwt_required()
@tenant_required
def update_order_status(order_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, tenant_id=tenant_id).filter(Order.reset_batch_id.is_(None)).first_or_404()
    data = request.get_json()
    new_status = data.get('status')
    allowed = ('open', 'order_placed', 'preparing', 'ready', 'served', 'billed', 'cancelled')
    if new_status not in allowed:
        return jsonify({'error': f'Invalid status. Must be one of: {", ".join(allowed)}'}), 400

    previous_status = order.status
    order.status = new_status

    if new_status == 'cancelled':
        # Free the table
        if order.table_id:
            table = db.session.get(TableMaster, order.table_id)
            if table and table.current_order_id == order.id:
                table.status = 'available'
                table.current_order_id = None
        # Restore inventory unless order was already billed (invoice handled it)
        if previous_status != 'billed':
            for item in order.items.all():
                _restore_inventory(
                    outlet_id=order.outlet_id,
                    tenant_id=tenant_id,
                    product_id=item.product_id,
                    variant_id=item.variant_id,
                    quantity=item.quantity,
                    user_id=user_id,
                    reference_id=order_id,
                )

    db.session.commit()
    return jsonify(order.to_dict())


@orders_bp.route('/<int:order_id>', methods=['GET'])
@jwt_required()
@tenant_required
def get_order(order_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    order = Order.query.filter_by(id=order_id, tenant_id=tenant_id).filter(Order.reset_batch_id.is_(None)).first_or_404()
    return jsonify(order.to_dict(include_items=True))


@orders_bp.route('/<int:order_id>/items', methods=['POST'])
@jwt_required()
@tenant_required
def add_items(order_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, tenant_id=tenant_id).filter(Order.reset_batch_id.is_(None)).first_or_404()

    if order.status in ('billed', 'cancelled'):
        return jsonify({'error': 'Cannot add items to a closed order'}), 400

    data = request.get_json()
    new_items = []
    for item_data in data.get('items', []):
        product = db.session.get(Product, item_data['product_id'])
        variant = db.session.get(ProductVariant, item_data.get('variant_id')) if item_data.get('variant_id') else None
        price = Decimal(str(variant.selling_price if variant else product.selling_price))
        qty = Decimal(str(item_data.get('quantity', 1)))
        if qty <= 0:
            return jsonify({'error': 'Item quantity must be greater than zero'}), 400

        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            variant_id=variant.id if variant else None,
            product_name=f"{product.name} {variant.variant_name if variant else ''}".strip(),
            variant_name=variant.variant_name if variant else None,
            quantity=qty,
            unit_price=price,
            net_amount=qty * price,
            special_instructions=item_data.get('special_instructions'),
        )
        db.session.add(order_item)
        new_items.append(order_item)

    if order.status == 'open':
        order.status = 'order_placed'

    db.session.flush()

    # Deduct inventory for newly added items
    for order_item in new_items:
        _deduct_inventory(
            outlet_id=order.outlet_id,
            tenant_id=tenant_id,
            product_id=order_item.product_id,
            variant_id=order_item.variant_id,
            quantity=order_item.quantity,
            user_id=user_id,
            reference_id=order.id,
        )

    db.session.commit()
    return jsonify(order.to_dict(include_items=True))


@orders_bp.route('/<int:order_id>/items/<int:item_id>', methods=['PATCH'])
@jwt_required()
@tenant_required
def update_order_item(order_id, item_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, tenant_id=tenant_id).filter(Order.reset_batch_id.is_(None)).first_or_404()
    if order.status in ('billed', 'cancelled'):
        return jsonify({'error': 'Cannot edit a closed order'}), 400

    item = OrderItem.query.filter_by(id=item_id, order_id=order_id).first_or_404()
    data = request.get_json()
    qty = Decimal(str(data.get('quantity', item.quantity)))
    if qty <= 0:
        return jsonify({'error': 'Quantity must be > 0. Use DELETE to remove.'}), 400

    old_qty = item.quantity
    diff = qty - old_qty
    item.quantity = qty
    item.net_amount = qty * item.unit_price

    # Adjust inventory for the quantity change
    if diff > 0:
        _deduct_inventory(
            outlet_id=order.outlet_id,
            tenant_id=tenant_id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            quantity=diff,
            user_id=user_id,
            reference_id=order_id,
        )
    elif diff < 0:
        _restore_inventory(
            outlet_id=order.outlet_id,
            tenant_id=tenant_id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            quantity=abs(diff),
            user_id=user_id,
            reference_id=order_id,
        )

    db.session.commit()
    return jsonify(order.to_dict(include_items=True))


@orders_bp.route('/<int:order_id>/items/<int:item_id>', methods=['DELETE'])
@jwt_required()
@tenant_required
def remove_order_item(order_id, item_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, tenant_id=tenant_id).filter(Order.reset_batch_id.is_(None)).first_or_404()
    if order.status in ('billed', 'cancelled'):
        return jsonify({'error': 'Cannot edit a closed order'}), 400

    item = OrderItem.query.filter_by(id=item_id, order_id=order_id).first_or_404()

    # Restore inventory before removing the item
    _restore_inventory(
        outlet_id=order.outlet_id,
        tenant_id=tenant_id,
        product_id=item.product_id,
        variant_id=item.variant_id,
        quantity=item.quantity,
        user_id=user_id,
        reference_id=order_id,
    )

    db.session.delete(item)
    db.session.commit()
    return jsonify(order.to_dict(include_items=True))
