from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app.extensions import db
from app.models import Outlet, TableMaster, UserOutlet
from app.auth.decorators import tenant_required

outlets_bp = Blueprint('outlets', __name__)


@outlets_bp.route('/', methods=['GET'])
@jwt_required()
@tenant_required
def list_outlets():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlets = Outlet.query.filter(
        Outlet.tenant_id == tenant_id,
        Outlet.is_active.is_not(False)
    ).all()
    return jsonify([o.to_dict() for o in outlets])


@outlets_bp.route('/', methods=['POST'])
@jwt_required()
@tenant_required
def create_outlet():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Outlet name is required'}), 400

    from app.models import Tenant, TenantSubscription
    tenant = Tenant.query.get(tenant_id)
    sub = tenant.active_subscription
    # Custom limit overrides plan limit when set by admin
    limit = tenant.custom_max_outlets
    if limit is None and sub:
        limit = sub.plan.max_outlets
    if limit is not None:
        current_outlets = Outlet.query.filter_by(tenant_id=tenant_id, is_active=True).count()
        if current_outlets >= limit:
            return jsonify({'error': f'Outlet limit reached ({limit} outlets allowed)'}), 403

    count = Outlet.query.filter_by(tenant_id=tenant_id).count()
    outlet_code = f"OUT-{str(tenant_id).zfill(4)}-{str(count + 1).zfill(3)}"

    outlet = Outlet(
        tenant_id=tenant_id,
        outlet_code=outlet_code,
        name=data['name'],
        outlet_type=data.get('outlet_type', 'bar_restaurant'),
        phone=data.get('phone'),
        email=data.get('email'),
        address=data.get('address'),
        city=data.get('city'),
        state=data.get('state'),
        gstin=data.get('gstin'),
        excise_license=data.get('excise_license'),
        tax_config=data.get('tax_config', {}),
    )
    db.session.add(outlet)
    db.session.commit()
    return jsonify(outlet.to_dict()), 201


@outlets_bp.route('/<int:outlet_id>', methods=['GET'])
@jwt_required()
@tenant_required
def get_outlet(outlet_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet = Outlet.query.filter_by(id=outlet_id, tenant_id=tenant_id).first_or_404()
    return jsonify(outlet.to_dict())


@outlets_bp.route('/<int:outlet_id>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_outlet(outlet_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet = Outlet.query.filter_by(id=outlet_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()

    for field in ['name', 'phone', 'email', 'address', 'city', 'state',
                  'gstin', 'excise_license', 'tax_config', 'receipt_config',
                  'printer_config', 'is_active']:
        if field in data:
            setattr(outlet, field, data[field])

    db.session.commit()
    return jsonify(outlet.to_dict())


@outlets_bp.route('/<int:outlet_id>/tables', methods=['GET'])
@jwt_required()
@tenant_required
def list_tables(outlet_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    Outlet.query.filter_by(id=outlet_id, tenant_id=tenant_id).first_or_404()
    tables = TableMaster.query.filter(
        TableMaster.outlet_id == outlet_id,
        TableMaster.is_active.is_not(False)
    ).all()
    return jsonify([t.to_dict() for t in tables])


@outlets_bp.route('/<int:outlet_id>/tables', methods=['POST'])
@jwt_required()
@tenant_required
def create_table(outlet_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    Outlet.query.filter_by(id=outlet_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()
    if not data or not data.get('table_number'):
        return jsonify({'error': 'table_number is required'}), 400

    table = TableMaster(
        outlet_id=outlet_id,
        table_number=data['table_number'],
        floor_section=data.get('floor_section', 'Main Hall'),
        seating_capacity=data.get('seating_capacity', 4),
    )
    db.session.add(table)
    db.session.commit()
    return jsonify(table.to_dict()), 201


@outlets_bp.route('/<int:outlet_id>/tables/<int:table_id>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_table(outlet_id, table_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    Outlet.query.filter_by(id=outlet_id, tenant_id=tenant_id).first_or_404()
    table = TableMaster.query.filter_by(id=table_id, outlet_id=outlet_id).first_or_404()
    data = request.get_json()

    for field in ['status', 'table_number', 'floor_section', 'seating_capacity', 'reservation_name']:
        if field in data:
            setattr(table, field, data[field])

    db.session.commit()
    return jsonify(table.to_dict())
