from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import datetime, timedelta
from app.extensions import db
from app.models import (
    User, UserOutlet, Outlet, TenantRoleConfig, ROLE_DEFAULT_CONFIGS, get_role_config,
    DataResetBatch, Order, OrderItem, KOT, KOTItem, Invoice, InvoiceItem, BillPayment,
    Purchase, PurchaseItem, InventoryLedger, StockBalance, StockTransfer, StockTransferItem,
    Expense, AuditLog,
)
from app.auth.decorators import tenant_required
from app.auth.routes import log_audit

users_bp = Blueprint('users', __name__)

# Roles that can be configured (owner and super_admin always have full access)
CONFIGURABLE_ROLES = ['admin', 'manager', 'cashier', 'waiter', 'kitchen', 'inventory_manager', 'accountant']


@users_bp.route('/', methods=['GET'])
@jwt_required()
@tenant_required
def list_users():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    users = User.query.filter_by(tenant_id=tenant_id).filter(User.reset_batch_id.is_(None)).all()
    return jsonify([u.to_dict() for u in users])


@users_bp.route('/', methods=['POST'])
@jwt_required()
@tenant_required
def create_user():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    caller_role = claims.get('role')

    if caller_role not in ('owner', 'admin', 'super_admin'):
        return jsonify({'error': 'Permission denied'}), 403

    data = request.get_json()
    if not data or not data.get('email') or not data.get('first_name') or not data.get('last_name') or not data.get('password'):
        return jsonify({'error': 'email, first_name, last_name, and password are required'}), 400
    if len(data['password']) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    requested_role = data.get('role', 'cashier')

    # Prevent admin from creating an owner (role must be lower than caller)
    if caller_role == 'admin' and requested_role in ('owner', 'admin'):
        return jsonify({'error': 'Admins cannot create owner or admin accounts'}), 403

    # Check user limit — custom admin override takes precedence over plan limit
    from app.models import Tenant
    tenant = Tenant.query.get(tenant_id)
    sub = tenant.active_subscription
    limit = tenant.custom_max_users
    if limit is None and sub:
        limit = sub.plan.max_users
    if limit is not None:
        current_users = User.query.filter_by(tenant_id=tenant_id, is_active=True).filter(User.reset_batch_id.is_(None)).count()
        if current_users >= limit:
            return jsonify({'error': f'User limit reached ({limit} users allowed)'}), 403

    if User.query.filter_by(email=data['email'].lower()).first():
        return jsonify({'error': 'Email already exists'}), 400

    count = User.query.filter_by(tenant_id=tenant_id).count()
    user = User(
        tenant_id=tenant_id,
        employee_code=f"EMP-{str(count + 1).zfill(4)}",
        first_name=data['first_name'],
        last_name=data['last_name'],
        email=data['email'].lower().strip(),
        phone=data.get('phone'),
        role=data.get('role', 'cashier'),
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.flush()

    for outlet_id in data.get('outlet_ids', []):
        outlet = Outlet.query.filter_by(id=outlet_id, tenant_id=tenant_id).first()
        if outlet:
            ua = UserOutlet(user_id=user.id, outlet_id=outlet_id)
            db.session.add(ua)

    caller_id = int(get_jwt_identity())
    log_audit(caller_id, 'user.created', tenant_id=tenant_id, resource_type='user', resource_id=user.id)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@users_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
@tenant_required
def get_user(user_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user = User.query.filter_by(id=user_id, tenant_id=tenant_id).filter(User.reset_batch_id.is_(None)).first_or_404()
    return jsonify(user.to_dict())


@users_bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_user(user_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    caller_role = claims.get('role')
    caller_id = int(get_jwt_identity())
    user = User.query.filter_by(id=user_id, tenant_id=tenant_id).filter(User.reset_batch_id.is_(None)).first_or_404()
    data = request.get_json()

    # Only owner/admin can manage other users
    if caller_id != user_id and caller_role not in ('owner', 'admin', 'super_admin'):
        return jsonify({'error': 'Permission denied'}), 403

    # Role or is_active changes require owner/admin
    if ('role' in data or 'is_active' in data) and caller_role not in ('owner', 'admin', 'super_admin'):
        return jsonify({'error': 'Permission denied'}), 403

    # Prevent admin from promoting to owner/admin
    if 'role' in data and caller_role == 'admin' and data['role'] in ('owner', 'admin'):
        return jsonify({'error': 'Admins cannot set owner or admin roles'}), 403

    for field in ['first_name', 'last_name', 'phone', 'role']:
        if field in data:
            setattr(user, field, data[field])

    # Deactivation: bump token_version to force-logout all active sessions
    if 'is_active' in data:
        was_active = user.is_active
        user.is_active = data['is_active']
        if was_active and not user.is_active:
            user.token_version = (user.token_version or 0) + 1

    if 'password' in data and data['password']:
        user.set_password(data['password'])

    if 'outlet_ids' in data:
        UserOutlet.query.filter_by(user_id=user.id).delete()
        for outlet_id in data['outlet_ids']:
            outlet = Outlet.query.filter_by(id=outlet_id, tenant_id=tenant_id).first()
            if outlet:
                ua = UserOutlet(user_id=user.id, outlet_id=outlet_id)
                db.session.add(ua)

    if 'role' in data:
        log_audit(caller_id, 'user.role_changed', tenant_id=tenant_id, resource_type='user', resource_id=user_id,
                  new={'role': data['role']})
    if 'is_active' in data:
        action = 'user.deactivated' if not data['is_active'] else 'user.reactivated'
        log_audit(caller_id, action, tenant_id=tenant_id, resource_type='user', resource_id=user_id)
    db.session.commit()
    return jsonify(user.to_dict())
@jwt_required()
@tenant_required
def list_role_configs():
    """Return effective permission config for all configurable roles."""
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    result = {}
    for role in CONFIGURABLE_ROLES:
        result[role] = get_role_config(tenant_id, role)
    return jsonify(result)


@users_bp.route('/role-configs/<string:role>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_role_config(role):
    """Owner/admin can update permission config for a role."""
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    caller_role = claims.get('role')

    if caller_role not in ('owner', 'admin', 'super_admin'):
        return jsonify({'error': 'Only owner or admin can manage role permissions'}), 403

    if role not in CONFIGURABLE_ROLES:
        return jsonify({'error': f'Role {role!r} is not configurable'}), 400

    data = request.get_json()
    user_id = int(get_jwt_identity())

    config = TenantRoleConfig.query.filter_by(tenant_id=tenant_id, role=role).first()
    if not config:
        config = TenantRoleConfig(tenant_id=tenant_id, role=role)
        db.session.add(config)

    config.pages = data.get('pages', ROLE_DEFAULT_CONFIGS[role]['pages'])
    config.actions = data.get('actions', ROLE_DEFAULT_CONFIGS[role]['actions'])
    config.approvals = data.get('approvals', ROLE_DEFAULT_CONFIGS[role]['approvals'])
    config.data_scope = data.get('data_scope', ROLE_DEFAULT_CONFIGS[role]['data_scope'])
    config.updated_by = user_id

    db.session.commit()
    return jsonify(config.to_dict())


@users_bp.route('/role-configs/<string:role>/reset', methods=['POST'])
@jwt_required()
@tenant_required
def reset_role_config(role):
    """Reset a role back to system defaults."""
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    caller_role = claims.get('role')

    if caller_role not in ('owner', 'admin', 'super_admin'):
        return jsonify({'error': 'Only owner or admin can reset role permissions'}), 403

    TenantRoleConfig.query.filter_by(tenant_id=tenant_id, role=role).delete()
    db.session.commit()
    return jsonify(ROLE_DEFAULT_CONFIGS.get(role, {}))


@users_bp.route('/reset-data', methods=['POST'])
@jwt_required()
@tenant_required
def reset_tenant_data():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    caller_role = claims.get('role')
    user_id = int(get_jwt_identity())

    if caller_role not in ('owner', 'admin'):
        return jsonify({'error': 'Only owner or admin can reset data'}), 403

    data = request.get_json() or {}
    if data.get('confirm') != 'RESET':
        return jsonify({'error': 'Type RESET to confirm'}), 400

    options = data.get('options', {})
    do_invoices  = bool(options.get('invoices'))
    do_orders    = bool(options.get('orders'))
    do_purchases = bool(options.get('purchases'))
    do_inventory = bool(options.get('inventory'))
    do_expenses  = bool(options.get('expenses'))
    do_staff     = bool(options.get('staff_users'))

    if not any([do_invoices, do_orders, do_purchases, do_inventory, do_expenses, do_staff]):
        return jsonify({'error': 'Select at least one category to reset'}), 400

    batch = DataResetBatch(
        tenant_id=tenant_id,
        reset_by=user_id,
        options=options,
        expires_at=datetime.utcnow() + timedelta(days=14),
    )
    db.session.add(batch)
    db.session.flush()

    outlet_ids = [r[0] for r in db.session.query(Outlet.id).filter_by(tenant_id=tenant_id).all()]

    if do_orders:
        Order.query.filter_by(tenant_id=tenant_id, reset_batch_id=None).update({'reset_batch_id': batch.id}, synchronize_session=False)
        KOT.query.filter_by(tenant_id=tenant_id, reset_batch_id=None).update({'reset_batch_id': batch.id}, synchronize_session=False)

    if do_invoices:
        Invoice.query.filter_by(tenant_id=tenant_id, reset_batch_id=None).update({'reset_batch_id': batch.id}, synchronize_session=False)

    if do_purchases:
        Purchase.query.filter_by(tenant_id=tenant_id, reset_batch_id=None).update({'reset_batch_id': batch.id}, synchronize_session=False)

    if do_inventory and outlet_ids:
        InventoryLedger.query.filter(InventoryLedger.outlet_id.in_(outlet_ids), InventoryLedger.reset_batch_id.is_(None)).update({'reset_batch_id': batch.id}, synchronize_session=False)
        StockBalance.query.filter(StockBalance.outlet_id.in_(outlet_ids), StockBalance.reset_batch_id.is_(None)).update({'reset_batch_id': batch.id}, synchronize_session=False)
        StockTransfer.query.filter(
            db.or_(StockTransfer.from_outlet_id.in_(outlet_ids), StockTransfer.to_outlet_id.in_(outlet_ids)),
            StockTransfer.reset_batch_id.is_(None),
        ).update({'reset_batch_id': batch.id}, synchronize_session=False)

    if do_expenses and outlet_ids:
        Expense.query.filter(Expense.outlet_id.in_(outlet_ids), Expense.reset_batch_id.is_(None)).update({'reset_batch_id': batch.id}, synchronize_session=False)

    if do_staff:
        User.query.filter(
            User.tenant_id == tenant_id,
            User.role.notin_(['owner', 'admin']),
            User.reset_batch_id.is_(None),
        ).update({'reset_batch_id': batch.id}, synchronize_session=False)

    log = AuditLog(
        user_id=user_id,
        tenant_id=tenant_id,
        action='tenant.data_reset',
        resource_type='tenant',
        resource_id=tenant_id,
        new_values=options,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent', '')[:500],
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({'message': 'Data soft-deleted. Restorable for 14 days.', 'batch': batch.to_dict()})


def _purge_batch(batch):
    """Hard-delete all rows belonging to a batch and mark it purged."""
    bid = batch.id
    outlet_ids = [r[0] for r in db.session.query(Outlet.id).filter_by(tenant_id=batch.tenant_id).all()]

    # Break circular FK first
    db.session.execute(db.text('UPDATE orders SET invoice_id = NULL WHERE reset_batch_id = :bid'), {'bid': bid})
    db.session.execute(db.text('UPDATE invoices SET order_id = NULL WHERE reset_batch_id = :bid'), {'bid': bid})
    db.session.flush()

    order_ids = [r[0] for r in db.session.query(Order.id).filter_by(reset_batch_id=bid).all()]
    if order_ids:
        KOTItem.query.filter(KOTItem.kot_id.in_(db.session.query(KOT.id).filter_by(reset_batch_id=bid))).delete(synchronize_session=False)
        KOT.query.filter_by(reset_batch_id=bid).delete(synchronize_session=False)
        OrderItem.query.filter(OrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
    Order.query.filter_by(reset_batch_id=bid).delete(synchronize_session=False)

    inv_ids = [r[0] for r in db.session.query(Invoice.id).filter_by(reset_batch_id=bid).all()]
    if inv_ids:
        BillPayment.query.filter(BillPayment.invoice_id.in_(inv_ids)).delete(synchronize_session=False)
        InvoiceItem.query.filter(InvoiceItem.invoice_id.in_(inv_ids)).delete(synchronize_session=False)
    Invoice.query.filter_by(reset_batch_id=bid).delete(synchronize_session=False)

    pur_ids = [r[0] for r in db.session.query(Purchase.id).filter_by(reset_batch_id=bid).all()]
    if pur_ids:
        PurchaseItem.query.filter(PurchaseItem.purchase_id.in_(pur_ids)).delete(synchronize_session=False)
    Purchase.query.filter_by(reset_batch_id=bid).delete(synchronize_session=False)

    xfer_q = StockTransfer.query.filter_by(reset_batch_id=bid)
    xfer_ids = [r[0] for r in xfer_q.with_entities(StockTransfer.id).all()]
    if xfer_ids:
        StockTransferItem.query.filter(StockTransferItem.transfer_id.in_(xfer_ids)).delete(synchronize_session=False)
    xfer_q.delete(synchronize_session=False)

    InventoryLedger.query.filter_by(reset_batch_id=bid).delete(synchronize_session=False)
    StockBalance.query.filter_by(reset_batch_id=bid).delete(synchronize_session=False)
    Expense.query.filter_by(reset_batch_id=bid).delete(synchronize_session=False)

    staff_ids = [r[0] for r in db.session.query(User.id).filter_by(reset_batch_id=bid).all()]
    if staff_ids:
        UserOutlet.query.filter(UserOutlet.user_id.in_(staff_ids)).delete(synchronize_session=False)
        User.query.filter_by(reset_batch_id=bid).delete(synchronize_session=False)

    batch.status = 'purged'


@users_bp.route('/reset-batches', methods=['GET'])
@jwt_required()
@tenant_required
def list_reset_batches():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')

    now = datetime.utcnow()

    # Lazy purge expired batches
    expired = DataResetBatch.query.filter(
        DataResetBatch.tenant_id == tenant_id,
        DataResetBatch.status == 'active',
        DataResetBatch.expires_at <= now,
    ).all()
    for b in expired:
        _purge_batch(b)
    if expired:
        db.session.commit()

    batches = DataResetBatch.query.filter_by(tenant_id=tenant_id, status='active').order_by(DataResetBatch.created_at.desc()).all()
    return jsonify([b.to_dict() for b in batches])


