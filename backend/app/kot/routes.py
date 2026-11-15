from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import datetime
from app.extensions import db
from app.models import KOT, KOTItem, Order, OrderItem
from app.auth.decorators import tenant_required

kot_bp = Blueprint('kot', __name__)


@kot_bp.route('/', methods=['GET'])
@jwt_required()
@tenant_required
def list_kots():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    status = request.args.get('status')
    station = request.args.get('station', 'kitchen')

    q = KOT.query.filter_by(tenant_id=tenant_id, station=station).filter(KOT.reset_batch_id.is_(None))
    if outlet_id:
        q = q.filter_by(outlet_id=outlet_id)
    if status:
        q = q.filter_by(status=status)
    else:
        q = q.filter(KOT.status.in_(['new', 'accepted', 'preparing']))

    kots = q.order_by(KOT.created_at.asc()).all()
    return jsonify([k.to_dict(include_items=True) for k in kots])


@kot_bp.route('/', methods=['POST'])
@jwt_required()
@tenant_required
def create_kot():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or not data.get('order_id'):
        return jsonify({'error': 'order_id is required'}), 400

    order = Order.query.filter_by(id=data['order_id'], tenant_id=tenant_id).first_or_404()

    count = KOT.query.filter_by(tenant_id=tenant_id, outlet_id=order.outlet_id).count()
    kot_number = f"KOT-{datetime.utcnow().strftime('%Y%m%d')}-{str(count + 1).zfill(4)}"

    # Separate food (kitchen) and liquor (bar) items
    items_data = data.get('items', [])
    food_items = [i for i in items_data if not i.get('is_liquor', False)]
    bar_items = [i for i in items_data if i.get('is_liquor', False)]

    kots_created = []

    for station, station_items in [('kitchen', food_items), ('bar', bar_items)]:
        if not station_items:
            continue

        kot = KOT(
            tenant_id=tenant_id,
            outlet_id=order.outlet_id,
            order_id=order.id,
            kot_number=f"{kot_number}-{station[0].upper()}",
            table_id=order.table_id,
            station=station,
            waiter_id=user_id,
            notes=data.get('notes'),
        )
        db.session.add(kot)
        db.session.flush()

        for item_data in station_items:
            order_item = OrderItem.query.get(item_data.get('order_item_id'))
            if order_item:
                kot_item = KOTItem(
                    kot_id=kot.id,
                    order_item_id=order_item.id,
                    product_name=order_item.product_name,
                    variant_name=order_item.variant_name,
                    quantity=item_data.get('quantity', order_item.quantity),
                    special_instructions=item_data.get('special_instructions'),
                )
                db.session.add(kot_item)

        order.status = 'order_placed'
        kots_created.append(kot)

    db.session.commit()
    return jsonify([k.to_dict() for k in kots_created]), 201


@kot_bp.route('/<int:kot_id>/status', methods=['PUT'])
@jwt_required()
@tenant_required
def update_kot_status(kot_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    kot = KOT.query.filter_by(id=kot_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()
    new_status = data.get('status')

    valid_transitions = {
        'new': ['accepted', 'cancelled'],
        'accepted': ['preparing', 'cancelled'],
        'preparing': ['ready'],
        'ready': ['served'],
        'served': [],
        'cancelled': [],
    }

    if new_status not in valid_transitions.get(kot.status, []):
        return jsonify({'error': f'Cannot transition from {kot.status} to {new_status}'}), 400

    kot.status = new_status
    if new_status == 'accepted':
        kot.accepted_at = datetime.utcnow()
    elif new_status == 'preparing':
        kot.preparing_at = datetime.utcnow()
    elif new_status == 'ready':
        kot.ready_at = datetime.utcnow()
    elif new_status == 'served':
        kot.served_at = datetime.utcnow()

    db.session.commit()
    return jsonify(kot.to_dict())
