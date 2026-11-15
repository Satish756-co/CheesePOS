from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app.extensions import db
from app.models import (
    StockBalance, InventoryLedger, StockTransfer, StockTransferItem,
    Product, ProductVariant, Outlet
)
from app.auth.decorators import tenant_required

inventory_bp = Blueprint('inventory', __name__)


@inventory_bp.route('/current-stock', methods=['GET'])
@jwt_required()
@tenant_required
def get_current_stock():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    low_stock_only = request.args.get('low_stock_only', 'false').lower() == 'true'
    search = request.args.get('search', '')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    q = StockBalance.query.join(Product).filter(
        StockBalance.tenant_id == tenant_id,
        StockBalance.reset_batch_id.is_(None),
    )
    if outlet_id:
        q = q.filter(StockBalance.outlet_id == outlet_id)
    if low_stock_only:
        q = q.filter(StockBalance.current_stock <= Product.low_stock_threshold)
    if search:
        q = q.filter(Product.name.ilike(f'%{search}%'))

    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    result = []
    for stock in pagination.items:
        product = Product.query.get(stock.product_id)
        variant = ProductVariant.query.get(stock.variant_id) if stock.variant_id else None
        result.append({
            **stock.to_dict(),
            'product_name': product.name if product else '',
            'variant_name': variant.variant_name if variant else '',
            'category': product.category.name if product and product.category else '',
            'is_low_stock': float(stock.current_stock) <= float(product.low_stock_threshold) if product else False,
        })

    return jsonify({
        'stock': result,
        'total': pagination.total,
        'pages': pagination.pages,
    })


@inventory_bp.route('/adjust', methods=['POST'])
@jwt_required()
@tenant_required
def adjust_stock():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data or not data.get('outlet_id') or not data.get('product_id') or data.get('adjustment') is None:
        return jsonify({'error': 'outlet_id, product_id, and adjustment are required'}), 400

    outlet_id = data['outlet_id']
    product_id = data['product_id']
    variant_id = data.get('variant_id')
    adjustment = float(data['adjustment'])
    reason = data.get('reason', 'Manual adjustment')

    stock = StockBalance.query.filter_by(
        outlet_id=outlet_id, product_id=product_id,
        variant_id=variant_id, tenant_id=tenant_id,
        reset_batch_id=None,
    ).first()

    if not stock:
        # Clear any soft-deleted stub so the unique constraint allows a fresh row
        StockBalance.query.filter(
            StockBalance.outlet_id == outlet_id,
            StockBalance.product_id == product_id,
            StockBalance.variant_id == variant_id,
            StockBalance.tenant_id == tenant_id,
            StockBalance.reset_batch_id.isnot(None),
        ).delete(synchronize_session=False)
        stock = StockBalance(
            tenant_id=tenant_id, outlet_id=outlet_id,
            product_id=product_id, variant_id=variant_id, current_stock=0
        )
        db.session.add(stock)
        db.session.flush()

    old_stock = float(stock.current_stock)
    stock.current_stock = old_stock + adjustment

    ledger = InventoryLedger(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        product_id=product_id,
        variant_id=variant_id,
        transaction_type='adjustment',
        quantity_in=max(adjustment, 0),
        quantity_out=max(-adjustment, 0),
        balance=stock.current_stock,
        notes=reason,
        created_by=user_id,
    )
    db.session.add(ledger)
    db.session.commit()

    return jsonify({'message': 'Stock adjusted', 'new_balance': float(stock.current_stock)})


@inventory_bp.route('/ledger', methods=['GET'])
@jwt_required()
@tenant_required
def get_ledger():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    product_id = request.args.get('product_id', type=int)
    outlet_id = request.args.get('outlet_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    q = InventoryLedger.query.filter_by(tenant_id=tenant_id).filter(InventoryLedger.reset_batch_id.is_(None))
    if product_id:
        q = q.filter_by(product_id=product_id)
    if outlet_id:
        q = q.filter_by(outlet_id=outlet_id)

    pagination = q.order_by(InventoryLedger.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'ledger': [l.to_dict() for l in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
    })


@inventory_bp.route('/transfer', methods=['POST'])
@jwt_required()
@tenant_required
def create_transfer():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data or not data.get('from_outlet_id') or not data.get('to_outlet_id') or not data.get('items'):
        return jsonify({'error': 'from_outlet_id, to_outlet_id, and items are required'}), 400

    count = StockTransfer.query.filter_by(tenant_id=tenant_id).count()
    transfer_number = f"TRF-{str(count + 1).zfill(6)}"

    transfer = StockTransfer(
        tenant_id=tenant_id,
        transfer_number=transfer_number,
        from_outlet_id=data['from_outlet_id'],
        to_outlet_id=data['to_outlet_id'],
        requested_by=user_id,
        notes=data.get('notes'),
    )
    db.session.add(transfer)
    db.session.flush()

    for item_data in data.get('items', []):
        if not item_data.get('product_id') or item_data.get('quantity') is None:
            continue
        item = StockTransferItem(
            transfer_id=transfer.id,
            product_id=item_data['product_id'],
            variant_id=item_data.get('variant_id'),
            requested_quantity=item_data['quantity'],
        )
        db.session.add(item)

    db.session.commit()
    return jsonify(transfer.to_dict()), 201
