from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from flask_mail import Message
from datetime import datetime, timedelta
from sqlalchemy import func
import secrets
import string
import threading
import html as html_mod
from app.extensions import db, mail, limiter
from app.models import (
    Tenant, Plan, TenantSubscription, SubscriptionPayment,
    User, UserOutlet, Outlet, Invoice, SupportTicket, PlatformSetting,
    DataResetBatch, Order, OrderItem, KOT, KOTItem, InvoiceItem, BillPayment,
    Purchase, PurchaseItem, InventoryLedger, StockBalance, StockTransfer, StockTransferItem,
    Expense, AuditLog,
)
from app.auth.decorators import super_admin_required

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/dashboard', methods=['GET'])
@jwt_required()
@super_admin_required
def admin_dashboard():
    now = datetime.utcnow()

    total_tenants = Tenant.query.count()
    active_tenants = Tenant.query.filter_by(status='active').count()
    trial_tenants = Tenant.query.filter_by(status='trial').count()
    expired_tenants = Tenant.query.filter_by(status='expired').count()
    total_outlets = Outlet.query.filter_by(is_active=True).count()

    # MRR: sum of active subscription amounts (monthly)
    active_subs = TenantSubscription.query.filter_by(status='active').all()
    mrr = sum(
        float(s.amount) if s.billing_cycle == 'monthly'
        else float(s.amount) / 12
        for s in active_subs
    )

    # Revenue this month
    month_start = now.replace(day=1, hour=0, minute=0, second=0)
    month_revenue = db.session.query(
        func.sum(SubscriptionPayment.total_amount)
    ).filter(
        SubscriptionPayment.status == 'paid',
        SubscriptionPayment.paid_at >= month_start,
    ).scalar() or 0

    open_tickets = SupportTicket.query.filter(
        SupportTicket.status.in_(['open', 'in_progress'])
    ).count()

    # New customers this month
    new_this_month = Tenant.query.filter(
        Tenant.created_at >= month_start
    ).count()

    return jsonify({
        'total_customers': total_tenants,
        'active_customers': active_tenants,
        'trial_customers': trial_tenants,
        'expired_customers': expired_tenants,
        'total_outlets': total_outlets,
        'mrr': mrr,
        'arr': mrr * 12,
        'month_revenue': float(month_revenue),
        'open_support_tickets': open_tickets,
        'new_customers_this_month': new_this_month,
    })


@admin_bp.route('/tenants', methods=['GET'])
@jwt_required()
@super_admin_required
def list_tenants():
    status = request.args.get('status')
    search = request.args.get('search', '')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    # Lazy purge: hard-delete tenants whose cooling period has expired
    expired = Tenant.query.filter(
        Tenant.deletion_status == 'pending_deletion',
        Tenant.deletion_expires_at < datetime.utcnow(),
    ).all()
    for t in expired:
        _hard_purge_tenant(t)

    q = Tenant.query
    if status == 'pending_deletion':
        q = q.filter(Tenant.deletion_status == 'pending_deletion')
    else:
        # Exclude soft-deleted tenants from normal views
        q = q.filter(db.or_(Tenant.deletion_status.is_(None), Tenant.deletion_status == ''))
        if status:
            q = q.filter_by(status=status)

    if search:
        q = q.filter(db.or_(
            Tenant.business_name.ilike(f'%{search}%'),
            Tenant.email.ilike(f'%{search}%'),
            Tenant.city.ilike(f'%{search}%'),
        ))

    pagination = q.order_by(Tenant.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'tenants': [t.to_dict(include_subscription=True) for t in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
    })


@admin_bp.route('/tenants/<int:tenant_id>', methods=['GET'])
@jwt_required()
@super_admin_required
def get_tenant(tenant_id):
    tenant = Tenant.query.get_or_404(tenant_id)
    data = tenant.to_dict(include_subscription=True)
    data['outlets'] = [o.to_dict() for o in tenant.outlets.all()]
    data['users'] = [u.to_dict() for u in tenant.users.all()]
    return jsonify(data)


@admin_bp.route('/tenants/<int:tenant_id>', methods=['PUT'])
@jwt_required()
@super_admin_required
def update_tenant(tenant_id):
    tenant = Tenant.query.get_or_404(tenant_id)
    data = request.get_json()

    for field in ['status', 'notes', 'is_verified']:
        if field in data:
            setattr(tenant, field, data[field])

    # Nullable integer overrides — explicit null clears the override (reverts to plan default)
    for field in ['custom_max_outlets', 'custom_max_users']:
        if field in data:
            val = data[field]
            if val is None:
                setattr(tenant, field, None)
            else:
                try:
                    setattr(tenant, field, int(val))
                except (ValueError, TypeError):
                    return jsonify({'error': f'{field} must be an integer or null'}), 400

    db.session.commit()
    return jsonify(tenant.to_dict(include_subscription=True))


@admin_bp.route('/plans', methods=['GET'])
@jwt_required()
@super_admin_required
def list_plans():
    plans = Plan.query.filter_by(is_active=True).order_by(Plan.display_order).all()
    return jsonify([p.to_dict() for p in plans])


@admin_bp.route('/plans', methods=['POST'])
@jwt_required()
@super_admin_required
def create_plan():
    data = request.get_json()
    if not data or not data.get('name') or not data.get('slug') or data.get('price_monthly') is None or data.get('price_yearly') is None:
        return jsonify({'error': 'name, slug, price_monthly, and price_yearly are required'}), 400
    plan = Plan(
        name=data['name'],
        slug=data['slug'],
        description=data.get('description'),
        price_monthly=data['price_monthly'],
        price_yearly=data['price_yearly'],
        max_outlets=data.get('max_outlets', 1),
        max_users=data.get('max_users', 3),
        features=data.get('features', {}),
        display_order=data.get('display_order', 0),
    )
    db.session.add(plan)
    db.session.commit()
    return jsonify(plan.to_dict()), 201


@admin_bp.route('/plans/<int:plan_id>', methods=['PUT'])
@jwt_required()
@super_admin_required
def update_plan(plan_id):
    plan = Plan.query.get_or_404(plan_id)
    data = request.get_json()
    for field in ['name', 'description', 'price_monthly', 'price_yearly',
                  'max_outlets', 'max_users', 'features', 'is_active']:
        if field in data:
            setattr(plan, field, data[field])
    db.session.commit()
    return jsonify(plan.to_dict())


@admin_bp.route('/revenue', methods=['GET'])
@jwt_required()
@super_admin_required
def revenue_report():
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    q = SubscriptionPayment.query.filter_by(status='paid')
    if date_from:
        q = q.filter(SubscriptionPayment.paid_at >= datetime.strptime(date_from, '%Y-%m-%d'))
    if date_to:
        q = q.filter(SubscriptionPayment.paid_at <= datetime.strptime(date_to, '%Y-%m-%d'))

    payments = q.all()
    total = sum(float(p.total_amount) for p in payments)
    gst = sum(float(p.gst_amount) for p in payments)

    return jsonify({
        'total_revenue': total,
        'gst_collected': gst,
        'net_revenue': total - gst,
        'payment_count': len(payments),
        'payments': [p.to_dict() for p in payments[-50:]],
    })


@admin_bp.route('/subscriptions', methods=['GET'])
@jwt_required()
@super_admin_required
def list_subscriptions():
    status = request.args.get('status')
    page = request.args.get('page', 1, type=int)

    q = TenantSubscription.query
    if status:
        q = q.filter_by(status=status)

    pagination = q.order_by(TenantSubscription.ends_at.asc()).paginate(page=page, per_page=20, error_out=False)
    return jsonify({
        'subscriptions': [s.to_dict() for s in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
    })


@admin_bp.route('/activate-subscription', methods=['POST'])
@jwt_required()
@super_admin_required
def activate_subscription():
    from datetime import timedelta
    data = request.get_json()
    if not data or not data.get('tenant_id') or not data.get('plan_id'):
        return jsonify({'error': 'tenant_id and plan_id are required'}), 400
    tenant_id = data['tenant_id']
    plan_id = data['plan_id']
    billing_cycle = data.get('billing_cycle', 'monthly')

    tenant = Tenant.query.get_or_404(tenant_id)
    plan = Plan.query.get_or_404(plan_id)

    now = datetime.utcnow()
    if billing_cycle == 'yearly':
        ends_at = now + timedelta(days=365)
        amount = plan.price_yearly
    else:
        ends_at = now + timedelta(days=30)
        amount = plan.price_monthly

    # Deactivate existing subscriptions
    TenantSubscription.query.filter_by(tenant_id=tenant_id, status='active').update({'status': 'cancelled'})

    sub = TenantSubscription(
        tenant_id=tenant_id,
        plan_id=plan_id,
        billing_cycle=billing_cycle,
        amount=amount,
        status='active',
        starts_at=now,
        ends_at=ends_at,
    )
    db.session.add(sub)
    tenant.status = 'active'
    db.session.commit()

    return jsonify({'message': 'Subscription activated', 'subscription': sub.to_dict()})


# ── Platform Settings ─────────────────────────────────────────────────

EDITABLE_SETTINGS = {
    'trial_days': {'type': 'int', 'label': 'Trial Period (days)', 'default': 14, 'min': 1, 'max': 90},
    'grace_period_days': {'type': 'int', 'label': 'Grace Period after expiry (days)', 'default': 7, 'min': 0, 'max': 30},
    'show_pricing': {'type': 'bool', 'label': 'Show Pricing Page', 'default': False},
}


@admin_bp.route('/settings', methods=['GET'])
@jwt_required()
@super_admin_required
def get_settings():
    result = {}
    for key, meta in EDITABLE_SETTINGS.items():
        raw = PlatformSetting.get(key)
        if meta['type'] == 'bool':
            value = (raw.lower() in ('true', '1', 'yes')) if raw is not None else meta['default']
        else:
            value = int(raw) if raw is not None else meta['default']
        result[key] = {
            'value': value,
            'label': meta['label'],
            'type': meta['type'],
            'min': meta.get('min'),
            'max': meta.get('max'),
        }
    return jsonify(result)


@admin_bp.route('/settings', methods=['PUT'])
@jwt_required()
@super_admin_required
def update_settings():
    data = request.get_json() or {}
    updated = {}
    for key, meta in EDITABLE_SETTINGS.items():
        if key in data:
            val = data[key]
            if meta['type'] == 'int':
                try:
                    val = int(val)
                except (ValueError, TypeError):
                    return jsonify({'error': f'{key} must be an integer'}), 400
                if 'min' in meta and val < meta['min']:
                    return jsonify({'error': f'{key} must be at least {meta["min"]}'}), 400
                if 'max' in meta and val > meta['max']:
                    return jsonify({'error': f'{key} must be at most {meta["max"]}'}), 400
            elif meta['type'] == 'bool':
                if isinstance(val, bool):
                    pass
                elif isinstance(val, str):
                    val = val.lower() in ('true', '1', 'yes')
                else:
                    val = bool(val)
            PlatformSetting.set(key, val)
            updated[key] = val
    if not updated:
        return jsonify({'error': 'No valid settings provided'}), 400
    db.session.commit()
    return jsonify({'message': 'Settings updated', 'updated': updated})


@admin_bp.route('/tenants/<int:tenant_id>/reset-data', methods=['POST'])
@limiter.limit("5 per minute")
@jwt_required()
@super_admin_required
def admin_reset_tenant_data(tenant_id):
    from flask_jwt_extended import get_jwt_identity
    user_id = int(get_jwt_identity())

    tenant = Tenant.query.get(tenant_id)
    if not tenant:
        return jsonify({'error': 'Tenant not found'}), 404

    data = request.get_json() or {}
    if data.get('confirm') != 'RESET':
        return jsonify({'error': 'Type RESET to confirm'}), 400

    options = data.get('options', {})
    do_invoices = bool(options.get('invoices'))
    do_orders = bool(options.get('orders'))
    do_purchases = bool(options.get('purchases'))
    do_inventory = bool(options.get('inventory'))
    do_expenses = bool(options.get('expenses'))
    do_staff = bool(options.get('staff_users'))

    if not any([do_invoices, do_orders, do_purchases, do_inventory, do_expenses, do_staff]):
        return jsonify({'error': 'Select at least one category to reset'}), 400

    outlet_ids = [r[0] for r in db.session.query(Outlet.id).filter_by(tenant_id=tenant_id).all()]

    if do_orders or do_invoices:
        if do_orders:
            db.session.execute(db.text('UPDATE orders SET invoice_id = NULL WHERE tenant_id = :tid'), {'tid': tenant_id})
        if do_invoices:
            db.session.execute(db.text('UPDATE invoices SET order_id = NULL WHERE tenant_id = :tid'), {'tid': tenant_id})
        db.session.flush()

        if do_orders:
            order_ids = [r[0] for r in db.session.query(Order.id).filter_by(tenant_id=tenant_id).all()]
            if order_ids:
                KOTItem.query.filter(KOTItem.kot_id.in_(
                    db.session.query(KOT.id).filter(KOT.order_id.in_(order_ids))
                )).delete(synchronize_session=False)
                KOT.query.filter(KOT.order_id.in_(order_ids)).delete(synchronize_session=False)
                OrderItem.query.filter(OrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
            Order.query.filter_by(tenant_id=tenant_id).delete(synchronize_session=False)

        if do_invoices:
            inv_ids = [r[0] for r in db.session.query(Invoice.id).filter_by(tenant_id=tenant_id).all()]
            if inv_ids:
                BillPayment.query.filter(BillPayment.invoice_id.in_(inv_ids)).delete(synchronize_session=False)
                InvoiceItem.query.filter(InvoiceItem.invoice_id.in_(inv_ids)).delete(synchronize_session=False)
            Invoice.query.filter_by(tenant_id=tenant_id).delete(synchronize_session=False)

    if do_purchases:
        pur_ids = [r[0] for r in db.session.query(Purchase.id).filter_by(tenant_id=tenant_id).all()]
        if pur_ids:
            PurchaseItem.query.filter(PurchaseItem.purchase_id.in_(pur_ids)).delete(synchronize_session=False)
        Purchase.query.filter_by(tenant_id=tenant_id).delete(synchronize_session=False)

    if do_inventory and outlet_ids:
        xfer_q = StockTransfer.query.filter(
            db.or_(StockTransfer.from_outlet_id.in_(outlet_ids), StockTransfer.to_outlet_id.in_(outlet_ids))
        )
        xfer_ids = [r[0] for r in xfer_q.with_entities(StockTransfer.id).all()]
        if xfer_ids:
            StockTransferItem.query.filter(StockTransferItem.transfer_id.in_(xfer_ids)).delete(synchronize_session=False)
        xfer_q.delete(synchronize_session=False)
        InventoryLedger.query.filter(InventoryLedger.outlet_id.in_(outlet_ids)).delete(synchronize_session=False)
        StockBalance.query.filter(StockBalance.outlet_id.in_(outlet_ids)).delete(synchronize_session=False)

    if do_expenses and outlet_ids:
        Expense.query.filter(Expense.outlet_id.in_(outlet_ids)).delete(synchronize_session=False)

    if do_staff:
        staff_ids = [r[0] for r in db.session.query(User.id).filter(
            User.tenant_id == tenant_id,
            User.role.notin_(['owner', 'admin']),
        ).all()]
        if staff_ids:
            UserOutlet.query.filter(UserOutlet.user_id.in_(staff_ids)).delete(synchronize_session=False)
            User.query.filter(User.id.in_(staff_ids)).delete(synchronize_session=False)

    log = AuditLog(
        user_id=user_id,
        tenant_id=tenant_id,
        action='admin.tenant_data_reset',
        resource_type='tenant',
        resource_id=tenant_id,
        new_values=options,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent', '')[:500],
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({'message': 'Selected data deleted successfully'})


# ── Reset batch management (admin can restore/purge client soft-deletes) ─────

@admin_bp.route('/tenants/<int:tenant_id>/reset-batches', methods=['GET'])
@jwt_required()
@super_admin_required
def list_tenant_reset_batches(tenant_id):
    tenant = Tenant.query.get(tenant_id)
    if not tenant:
        return jsonify({'error': 'Tenant not found'}), 404

    now = datetime.utcnow()
    # Lazy purge expired batches
    from app.users.routes import _purge_batch
    expired = DataResetBatch.query.filter(
        DataResetBatch.tenant_id == tenant_id,
        DataResetBatch.status == 'active',
        DataResetBatch.expires_at <= now,
    ).all()
    for b in expired:
        _purge_batch(b)
    if expired:
        db.session.commit()

    batches = DataResetBatch.query.filter_by(tenant_id=tenant_id).order_by(DataResetBatch.created_at.desc()).all()
    return jsonify([b.to_dict() for b in batches])


@admin_bp.route('/tenants/<int:tenant_id>/reset-batches/<int:batch_id>/restore', methods=['POST'])
@jwt_required()
@super_admin_required
def restore_reset_batch(tenant_id, batch_id):
    batch = DataResetBatch.query.filter_by(id=batch_id, tenant_id=tenant_id).first_or_404()
    if batch.status != 'active':
        return jsonify({'error': f'Batch is already {batch.status}'}), 400
    if batch.expires_at <= datetime.utcnow():
        return jsonify({'error': 'Batch has expired and cannot be restored'}), 400

    # Clear reset_batch_id from all rows
    for model in (Order, KOT, Invoice, Purchase, InventoryLedger, StockBalance, StockTransfer, Expense):
        model.query.filter_by(reset_batch_id=batch_id).update({'reset_batch_id': None}, synchronize_session=False)
    User.query.filter_by(reset_batch_id=batch_id).update({'reset_batch_id': None}, synchronize_session=False)

    batch.status = 'restored'
    db.session.commit()
    return jsonify({'message': 'Data restored successfully'})


@admin_bp.route('/tenants/<int:tenant_id>/reset-batches/<int:batch_id>/purge', methods=['POST'])
@jwt_required()
@super_admin_required
def purge_reset_batch(tenant_id, batch_id):
    batch = DataResetBatch.query.filter_by(id=batch_id, tenant_id=tenant_id).first_or_404()
    if batch.status == 'purged':
        return jsonify({'error': 'Already purged'}), 400

    from app.users.routes import _purge_batch
    _purge_batch(batch)
    db.session.commit()
    return jsonify({'message': 'Batch permanently deleted'})


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _gen_temp_password(length=12):
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


def _send_async(app, msg):
    with app.app_context():
        try:
            mail.send(msg)
        except Exception as e:
            app.logger.error(f'Admin welcome email failed: {e}')


def _send_welcome_email(app, email, business_name, owner_name, temp_password):
    msg = Message(
        subject=f'Welcome to CheesePOS — Your account is ready',
        recipients=[email],
        html=f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
          <div style="background:#1e293b;color:#fff;padding:20px 24px;border-radius:8px;margin-bottom:24px">
            <h2 style="margin:0;font-size:22px">Welcome to CheesePOS!</h2>
            <p style="margin:6px 0 0;font-size:13px;color:#94a3b8">Your account has been created.</p>
          </div>
          <p style="color:#374151;font-size:15px">Hi <strong>{html_mod.escape(owner_name)}</strong>,</p>
          <p style="color:#6b7280;font-size:14px">Your CheesePOS account for <strong>{html_mod.escape(business_name)}</strong> is ready. Use the credentials below to log in.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0">
            <table style="width:100%;font-size:14px">
              <tr>
                <td style="color:#6b7280;padding:6px 0;width:130px">Login Email</td>
                <td style="color:#1e293b;font-weight:bold">{html_mod.escape(email)}</td>
              </tr>
              <tr>
                <td style="color:#6b7280;padding:6px 0">Temporary Password</td>
                <td style="color:#1e293b;font-weight:bold;font-family:monospace;font-size:16px;letter-spacing:0.05em">{html_mod.escape(temp_password)}</td>
              </tr>
            </table>
          </div>
          <div style="background:#fef3c7;border-radius:8px;padding:14px 18px;margin-bottom:20px;font-size:13px;color:#92400e">
            <strong>Important:</strong> You will be asked to set a new password on your first login. Please do so immediately for security.
          </div>
          <p style="color:#6b7280;font-size:13px;margin-top:24px">If you need help, contact us at <a href="mailto:cheesepossupport@gmail.com" style="color:#3b82f6">cheesepossupport@gmail.com</a></p>
        </div>
        """,
    )
    thread = threading.Thread(target=_send_async, args=(app, msg))
    thread.daemon = True
    thread.start()


def _hard_purge_tenant(tenant):
    """Hard-delete all data for a tenant. Called after cooling period expires."""
    tid = tenant.id
    stmts = [
        "UPDATE orders SET invoice_id = NULL WHERE tenant_id = :tid",
        "UPDATE invoices SET order_id = NULL WHERE tenant_id = :tid",
        "DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE tenant_id = :tid)",
        "DELETE FROM support_tickets WHERE tenant_id = :tid",
        "DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = :tid)",
        "DELETE FROM bill_payments WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = :tid)",
        "DELETE FROM invoices WHERE tenant_id = :tid",
        "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE tenant_id = :tid)",
        "DELETE FROM kot_items WHERE kot_id IN (SELECT id FROM kots WHERE tenant_id = :tid)",
        "DELETE FROM kots WHERE tenant_id = :tid",
        "DELETE FROM orders WHERE tenant_id = :tid",
        "DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE tenant_id = :tid)",
        "DELETE FROM purchases WHERE tenant_id = :tid",
        "DELETE FROM stock_transfer_items WHERE transfer_id IN (SELECT id FROM stock_transfers WHERE tenant_id = :tid)",
        "DELETE FROM stock_transfers WHERE tenant_id = :tid",
        "DELETE FROM inventory_ledger WHERE tenant_id = :tid",
        "DELETE FROM stock_balances WHERE tenant_id = :tid",
        "DELETE FROM expenses WHERE tenant_id = :tid",
        "DELETE FROM audit_logs WHERE tenant_id = :tid",
        "DELETE FROM user_outlets WHERE user_id IN (SELECT id FROM users WHERE tenant_id = :tid)",
        "DELETE FROM users WHERE tenant_id = :tid",
        "DELETE FROM products WHERE tenant_id = :tid",
        "DELETE FROM outlets WHERE tenant_id = :tid",
        "DELETE FROM subscription_payments WHERE tenant_id = :tid",
        "DELETE FROM tenant_subscriptions WHERE tenant_id = :tid",
        "DELETE FROM tenant_role_configs WHERE tenant_id = :tid",
        "DELETE FROM data_reset_batches WHERE tenant_id = :tid",
    ]
    for stmt in stmts:
        try:
            db.session.execute(db.text(stmt), {'tid': tid})
        except Exception as e:
            current_app.logger.warning(f'Purge: {stmt} → {e}')
    try:
        db.session.delete(tenant)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Failed to delete tenant {tid}: {e}')


# ─── Create customer ─────────────────────────────────────────────────────────

@admin_bp.route('/tenants', methods=['POST'])
@jwt_required()
@super_admin_required
def create_tenant():
    data = request.get_json() or {}
    required = ['business_name', 'email', 'first_name', 'last_name', 'phone']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f"Missing: {', '.join(missing)}"}), 400

    email = data['email'].lower().strip()
    if User.query.filter_by(email=email).first() or Tenant.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 400

    count = Tenant.query.count()
    tenant_code = f"TEN-{str(count + 1).zfill(6)}"
    trial_days = PlatformSetting.get_int('trial_days', 14)

    tenant = Tenant(
        tenant_code=tenant_code,
        business_name=data['business_name'],
        owner_name=f"{data['first_name']} {data['last_name']}",
        email=email,
        phone=data['phone'],
        city=data.get('city', ''),
        state=data.get('state', ''),
        address=data.get('address', ''),
        status='trial',
        trial_ends_at=datetime.utcnow() + timedelta(days=trial_days),
        notes=data.get('notes', ''),
    )
    db.session.add(tenant)
    db.session.flush()

    temp_password = _gen_temp_password()
    owner = User(
        tenant_id=tenant.id,
        first_name=data['first_name'],
        last_name=data['last_name'],
        email=email,
        phone=data['phone'],
        role='owner',
        is_active=True,
        must_change_password=True,
    )
    owner.set_password(temp_password)
    db.session.add(owner)

    # Create a default outlet
    outlet = Outlet(
        tenant_id=tenant.id,
        outlet_code=f"{tenant_code}-01",
        name=data['business_name'],
        address=data.get('address', ''),
        city=data.get('city', ''),
        state=data.get('state', ''),
        is_active=True,
    )
    db.session.add(outlet)
    db.session.commit()

    app = current_app._get_current_object()
    _send_welcome_email(app, email, tenant.business_name, owner.full_name, temp_password)

    return jsonify(tenant.to_dict(include_subscription=True)), 201


# ─── Soft-delete tenant (14-day cooling period) ──────────────────────────────

@admin_bp.route('/tenants/<int:tenant_id>', methods=['DELETE'])
@jwt_required()
@super_admin_required
def delete_tenant(tenant_id):
    tenant = Tenant.query.get_or_404(tenant_id)
    if tenant.deletion_status == 'pending_deletion':
        return jsonify({'error': 'Already pending deletion'}), 400

    tenant.deletion_status = 'pending_deletion'
    tenant.deleted_at = datetime.utcnow()
    tenant.deletion_expires_at = datetime.utcnow() + timedelta(days=14)
    tenant.status = 'suspended'
    db.session.commit()
    return jsonify(tenant.to_dict())


# ─── Admin: per-tenant feature overrides ─────────────────────────────────────

ALLOWED_FEATURE_KEYS = [
    'billing', 'table_billing', 'tables', 'orders', 'sales_log', 'kot',
    'products', 'inventory', 'purchases', 'expenses', 'reports',
    'users', 'roles', 'outlets', 'dashboard', 'support',
]

@admin_bp.route('/tenants/<int:tenant_id>/feature-overrides', methods=['PUT'])
@jwt_required()
@super_admin_required
def update_feature_overrides(tenant_id):
    tenant = Tenant.query.get_or_404(tenant_id)
    data = request.get_json() or {}

    overrides = {}
    for key in ALLOWED_FEATURE_KEYS:
        if key in data:
            val = data[key]
            if val is False:
                overrides[key] = False   # explicitly disabled
            # True or None = remove override (use plan/role default)

    tenant.feature_overrides = overrides
    db.session.commit()
    return jsonify({'feature_overrides': tenant.feature_overrides})


# ─── Admin: reset a user's password ─────────────────────────────────────────

@admin_bp.route('/tenants/<int:tenant_id>/users/<int:user_id>/reset-password', methods=['POST'])
@jwt_required()
@super_admin_required
def admin_reset_user_password(tenant_id, user_id):
    user = User.query.filter_by(id=user_id, tenant_id=tenant_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    temp_password = _gen_temp_password()
    user.set_password(temp_password)
    user.must_change_password = True
    db.session.commit()

    return jsonify({
        'message': f'Password reset for {user.email}',
        'temp_password': temp_password,
        'user_email': user.email,
        'user_name': user.full_name,
    })


# ─── Reactivate tenant during cooling period ─────────────────────────────────

@admin_bp.route('/tenants/<int:tenant_id>/reactivate', methods=['POST'])
@jwt_required()
@super_admin_required
def reactivate_tenant(tenant_id):
    tenant = Tenant.query.get_or_404(tenant_id)
    if tenant.deletion_status != 'pending_deletion':
        return jsonify({'error': 'Tenant is not pending deletion'}), 400

    tenant.deletion_status = None
    tenant.deleted_at = None
    tenant.deletion_expires_at = None
    tenant.status = 'trial'  # restore to trial; admin can activate manually
    db.session.commit()
    return jsonify(tenant.to_dict())
