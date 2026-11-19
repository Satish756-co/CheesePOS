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
    User, UserOutlet, UserTenantAccess, Outlet, Invoice, SupportTicket, PlatformSetting,
    DataResetBatch, Order, OrderItem, KOT, KOTItem, InvoiceItem, BillPayment,
    Purchase, PurchaseItem, InventoryLedger, StockBalance, StockTransfer, StockTransferItem,
    Expense, AuditLog, OnboardingRequest,
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
    business_type = request.args.get('business_type', '')
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

    if business_type:
        q = q.filter_by(business_type=business_type)

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
            print(f'[EMAIL ERROR] Admin welcome email failed: {e}', flush=True)
            app.logger.error(f'Admin welcome email failed: {e}')


def _send_new_business_email(app, email, business_name, owner_name):
    msg = Message(
        subject=f'New business added to your CheesePOS account — {business_name}',
        recipients=[email],
        html=f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
          <div style="background:#1e293b;color:#fff;padding:20px 24px;border-radius:8px;margin-bottom:24px">
            <h2 style="margin:0;font-size:22px">New Business Added!</h2>
            <p style="margin:6px 0 0;font-size:13px;color:#94a3b8">Your account now has access to a new business.</p>
          </div>
          <p style="color:#374151;font-size:15px">Hi <strong>{html_mod.escape(owner_name)}</strong>,</p>
          <p style="color:#6b7280;font-size:14px">
            Your CheesePOS account has been given access to a new business:
            <strong style="color:#111827">{html_mod.escape(business_name)}</strong>.
          </p>
          <p style="color:#6b7280;font-size:14px">
            Log in with your existing credentials. After signing in, you'll be able to select which business to manage.
          </p>
          <div style="background:#eff6ff;border-radius:8px;padding:14px 18px;margin:20px 0;font-size:13px;color:#1d4ed8">
            Use the same email and password you already use to log in.
          </div>
          <p style="color:#6b7280;font-size:13px;margin-top:24px">
            If you didn't expect this, contact us at <a href="mailto:cheesepossupport@gmail.com" style="color:#3b82f6">cheesepossupport@gmail.com</a>
          </p>
        </div>
        """,
    )
    thread = threading.Thread(target=_send_async, args=(app, msg))
    thread.daemon = True
    thread.start()


def _send_welcome_email(app, email, business_name, owner_name, temp_password, business_type='bar_restaurant'):
    frontend_url = app.config.get('FRONTEND_URL', 'http://localhost:5173')
    login_url = frontend_url.rstrip('/') + '/login'

    # ── Business-type steps ──────────────────────────────────────────────────
    if business_type == 'saloon':
        steps_rows = [
            ('✂️', 'Set up your services',
             'Go to <strong>Services</strong> → add service categories, services with pricing, duration, and commission.'),
            ('💅', 'Create packages & coupons',
             'Bundle services into combo packages. Add discount coupons for promotions and loyal customers.'),
            ('💰', 'Create your first bill',
             'Open <strong>Billing</strong>, pick a customer, select services or packages, apply a coupon if needed, and collect payment.'),
            ('📊', 'Track revenue & performance',
             'The <strong>Dashboard</strong> shows daily revenue, top services, and staff performance. <strong>Bills Log</strong> lists every transaction.'),
        ]
    else:
        steps_rows = [
            ('🏪', 'Set up your space',
             'Go to <strong>Settings → Outlets</strong> to add your outlet details, then configure tables under <strong>Tables</strong>.'),
            ('🍽️', 'Build your menu',
             'Add product categories and items in <strong>Products</strong>. Set prices, variants (e.g. 500 ml / 750 ml), and tax rates.'),
            ('📋', 'Start taking orders',
             'Use <strong>Table Billing</strong> for dine-in orders or <strong>Counter Billing</strong> for quick counter sales.'),
            ('📊', 'Track your business',
             'View daily summaries in <strong>Dashboard</strong>, monitor stock in <strong>Inventory</strong>, and export reports anytime.'),
        ]

    steps_html = ''.join(f"""
      <tr>
        <td style="padding:16px 0;vertical-align:top;border-bottom:1px solid #f3f4f6;">
          <table style="border-collapse:collapse;width:100%"><tr>
            <td style="width:44px;vertical-align:top;padding-right:12px;">
              <div style="width:40px;height:40px;border-radius:50%;background:#fff7ed;display:flex;align-items:center;justify-content:center;font-size:20px;text-align:center;line-height:40px;">
                {icon}
              </div>
            </td>
            <td style="vertical-align:top;">
              <p style="margin:0 0 4px;font-size:15px;font-weight:bold;color:#111827;">Step {i}. {title}</p>
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">{desc}</p>
            </td>
          </tr></table>
        </td>
      </tr>""" for i, (icon, title, desc) in enumerate(steps_rows, 1))

    biz_label = 'Saloon' if business_type == 'saloon' else 'Bar &amp; Restaurant'

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to CheesePOS</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<style>
  @keyframes flapOpen {{
    0%   {{ transform: perspective(600px) rotateX(0deg); opacity:1; }}
    45%  {{ transform: perspective(600px) rotateX(-170deg); opacity:0.9; }}
    100% {{ transform: perspective(600px) rotateX(-180deg); opacity:0; visibility:hidden; }}
  }}
  @keyframes letterRise {{
    0%   {{ opacity:0; transform:translateY(40px); }}
    100% {{ opacity:1; transform:translateY(0); }}
  }}
  @keyframes fadeIn {{
    from {{ opacity:0; }} to {{ opacity:1; }}
  }}
  .env-flap     {{ transform-origin: top center; animation: flapOpen 1.4s cubic-bezier(.4,0,.2,1) 0.6s both; backface-visibility:hidden; }}
  .letter-body  {{ animation: letterRise 0.9s ease-out 1.5s both; }}
  .footer-block {{ animation: fadeIn 0.8s ease-out 2.2s both; }}
</style>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- ═══ ENVELOPE WRAPPER ═══ -->
  <tr><td style="position:relative;">
    <div style="position:relative;overflow:hidden;">

      <!-- Envelope body (orange background) -->
      <div style="background:linear-gradient(145deg,#f97316 0%,#ea580c 100%);min-height:280px;position:relative;text-align:center;padding-bottom:40px;">

        <!-- Bottom-left fold line -->
        <div style="position:absolute;bottom:0;left:0;width:0;height:0;border-bottom:80px solid #c2410c;border-right:300px solid transparent;"></div>
        <!-- Bottom-right fold line -->
        <div style="position:absolute;bottom:0;right:0;width:0;height:0;border-bottom:80px solid #c2410c;border-left:300px solid transparent;"></div>

        <!-- Main envelope text (always visible) -->
        <div style="position:relative;z-index:2;padding:48px 40px 24px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:bold;letter-spacing:3px;color:rgba(255,255,255,0.75);text-transform:uppercase;">CheesePOS</p>
          <h1 style="margin:0;font-size:58px;font-weight:900;color:#fff;line-height:1;font-family:Georgia,'Times New Roman',serif;text-shadow:0 3px 12px rgba(0,0,0,0.25);">welcome</h1>
          <h2 style="margin:0;font-size:46px;font-weight:700;font-style:italic;color:rgba(255,255,255,0.95);font-family:Georgia,'Times New Roman',serif;text-shadow:0 2px 8px rgba(0,0,0,0.2);">on board.</h2>
          <p style="margin:16px 0 0;font-size:14px;color:rgba(255,255,255,0.85);letter-spacing:0.5px;">
            Your <strong style="color:#fff;">{html_mod.escape(business_name)}</strong> account is activated ✨
          </p>
        </div>

        <!-- Animated flap (top triangle) — folds open on load -->
        <div class="env-flap" style="position:absolute;top:0;left:0;right:0;z-index:3;">
          <div style="width:0;height:0;border-left:300px solid transparent;border-right:300px solid transparent;border-top:160px solid #fb923c;margin:0 auto;"></div>
          <!-- Pink seal line (decorative) -->
          <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:2px;height:160px;background:linear-gradient(to bottom,rgba(236,72,153,0.7),transparent);"></div>
        </div>

      </div>
    </div>
  </td></tr>

  <!-- ═══ LETTER CONTENT ═══ -->
  <tr><td>
    <div class="letter-body" style="background:#fff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:40px;">

      <p style="margin:0 0 8px;font-size:18px;color:#111827;">
        Hi <strong>{html_mod.escape(owner_name)}</strong> 👋
      </p>
      <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
        Your <strong style="color:#374151;">{html_mod.escape(business_name)}</strong> ({biz_label}) account is now live.
        Below are your login credentials — keep them safe.
      </p>

      <!-- Credentials card -->
      <div style="background:#fafafa;border:2px solid #fed7aa;border-radius:12px;padding:24px;margin-bottom:24px;">
        <p style="margin:0 0 16px;font-size:11px;font-weight:bold;color:#ea580c;letter-spacing:2px;text-transform:uppercase;">Your Login Details</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;width:150px;">📧 Email</td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-weight:bold;">{html_mod.escape(email)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">🔑 Temp Password</td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-weight:bold;font-family:monospace;font-size:20px;letter-spacing:3px;">{html_mod.escape(temp_password)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#6b7280;">🔗 App URL</td>
            <td style="padding:10px 0;">
              <a href="{login_url}" style="color:#ea580c;font-weight:bold;font-size:14px;text-decoration:none;">{login_url}</a>
            </td>
          </tr>
        </table>
      </div>

      <!-- CTA button -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="{login_url}"
           style="display:inline-block;background:linear-gradient(135deg,#f97316,#dc2626);color:#fff;padding:15px 44px;border-radius:50px;font-size:16px;font-weight:bold;text-decoration:none;letter-spacing:0.5px;box-shadow:0 4px 16px rgba(249,115,22,0.45);">
          Open CheesePOS &rarr;
        </a>
      </div>

      <!-- First-login notice -->
      <div style="background:#fff7ed;border-left:4px solid #f97316;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:36px;font-size:13px;color:#9a3412;line-height:1.5;">
        <strong>🔐 First login:</strong> You will be prompted to set a new password immediately.
        Please choose a strong password and keep it private.
      </div>

      <!-- Getting started -->
      <p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:#111827;">Getting started</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        {steps_html}
      </table>

    </div>
  </td></tr>

  <!-- ═══ FOOTER ═══ -->
  <tr><td>
    <div class="footer-block" style="background:#1e293b;border-radius:0 0 12px 12px;padding:28px 40px;text-align:center;">
      <p style="margin:0 0 8px;color:#fff;font-weight:bold;font-size:15px;">CheesePOS</p>
      <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;">
        Questions? Contact us at
        <a href="mailto:cheesepossupport@gmail.com" style="color:#fb923c;text-decoration:none;">cheesepossupport@gmail.com</a>
      </p>
      <p style="margin:0;font-size:11px;color:#475569;">
        You received this email because an account was created for {html_mod.escape(email)}.
      </p>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""

    plain_text = (
        f'Welcome to CheesePOS!\n\n'
        f'Your {biz_label} business "{business_name}" is ready.\n\n'
        f'Login URL: {login_url}\n'
        f'Password:  {temp_password}\n\n'
        f'This is a temporary password — please change it after your first login.\n\n'
        f'Support: cheesepossupport@gmail.com'
    )
    msg = Message(
        subject=f'Welcome to CheesePOS — {html_mod.escape(business_name)} is ready!',
        recipients=[email],
        body=plain_text,
        html=html_content,
    )
    print(f'[EMAIL] Sending welcome email to {email} for {business_name}', flush=True)
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
        "DELETE FROM user_tenant_access WHERE tenant_id = :tid",
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
    db.session.delete(tenant)
    db.session.commit()


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

    # Seed junction table so multi-business works from the start
    access = UserTenantAccess(user_id=owner.id, tenant_id=tenant.id, role='owner')
    db.session.add(access)
    db.session.commit()

    app = current_app._get_current_object()
    _send_welcome_email(app, email, tenant.business_name, owner.full_name, temp_password,
                        business_type=data.get('business_type', 'bar_restaurant'))

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


@admin_bp.route('/tenants/<int:tenant_id>/force-delete', methods=['DELETE'])
@jwt_required()
@super_admin_required
def force_delete_tenant(tenant_id):
    tenant = Tenant.query.get_or_404(tenant_id)
    if tenant.deletion_status != 'pending_deletion':
        return jsonify({'error': 'Tenant is not in pending_deletion state'}), 400
    try:
        _hard_purge_tenant(tenant)
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'force_delete_tenant {tenant_id}: {e}')
        return jsonify({'error': 'Failed to delete tenant — check server logs'}), 500
    return jsonify({'message': 'Tenant permanently deleted'})


# ─── Onboarding Requests ──────────────────────────────────────────────────────

@admin_bp.route('/onboarding-requests', methods=['GET'])
@jwt_required()
@super_admin_required
def list_onboarding_requests():
    status = request.args.get('status')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    q = OnboardingRequest.query
    if status:
        q = q.filter_by(status=status)

    pagination = q.order_by(OnboardingRequest.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    pending_count = OnboardingRequest.query.filter_by(status='pending').count()

    return jsonify({
        'requests': [r.to_dict() for r in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'pending_count': pending_count,
    })


@admin_bp.route('/onboarding-requests/<int:req_id>/approve', methods=['POST'])
@jwt_required()
@super_admin_required
def approve_onboarding_request(req_id):
    orq = OnboardingRequest.query.get_or_404(req_id)
    if orq.status != 'pending':
        return jsonify({'error': f'Request is already {orq.status}'}), 400

    admin_user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    # Use submitted info or allow admin to override
    business_name = data.get('business_name', orq.business_name).strip()
    email = data.get('email', orq.email).lower().strip()
    owner_name = data.get('owner_name', orq.owner_name or '').strip()
    phone = data.get('phone', orq.phone).strip()
    city = data.get('city', orq.city or '').strip()
    state = data.get('state', orq.state or '').strip()
    pincode = data.get('pincode', orq.pincode or '').strip()
    country = data.get('country', orq.country or '').strip()
    business_type = data.get('business_type', orq.business_type or 'bar_restaurant').strip()

    existing_user = User.query.filter_by(email=email).first()

    # Only block if the email belongs to a tenant but no user account matches
    # (data inconsistency guard). If existing_user is found, we link the new
    # business to their account — the multi-business path.
    if not existing_user:
        existing_tenant_check = Tenant.query.filter_by(email=email).first()
        if existing_tenant_check:
            return jsonify({'error': 'This business email is already registered to another account'}), 400

    # Split owner name into first/last
    parts = owner_name.split(' ', 1)
    first_name = parts[0] if parts else owner_name
    last_name = parts[1] if len(parts) > 1 else ''

    count = Tenant.query.count()
    tenant_code = f"TEN-{str(count + 1).zfill(6)}"
    trial_days = PlatformSetting.get_int('trial_days', 14)

    tenant = Tenant(
        tenant_code=tenant_code,
        business_name=business_name,
        owner_name=owner_name or (existing_user.full_name if existing_user else email),
        email=email,
        phone=phone,
        city=city,
        state=state,
        pincode=pincode,
        country=country,
        business_type=business_type,
        status='trial',
        trial_ends_at=datetime.utcnow() + timedelta(days=trial_days),
    )
    db.session.add(tenant)
    db.session.flush()

    if existing_user:
        # Reuse existing account — just link to new tenant
        owner = existing_user
        temp_password = None
        access = UserTenantAccess(user_id=existing_user.id, tenant_id=tenant.id, role='owner')
        db.session.add(access)
    else:
        # Brand-new user
        temp_password = _gen_temp_password()
        owner = User(
            tenant_id=tenant.id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            role='owner',
            is_active=True,
            must_change_password=True,
        )
        owner.set_password(temp_password)
        db.session.add(owner)
        db.session.flush()
        access = UserTenantAccess(user_id=owner.id, tenant_id=tenant.id, role='owner')
        db.session.add(access)

    outlet = Outlet(
        tenant_id=tenant.id,
        outlet_code=f"{tenant_code}-01",
        name=business_name,
        city=city,
        state=state,
        pincode=pincode,
        is_active=True,
    )
    db.session.add(outlet)

    orq.status = 'approved'
    orq.reviewed_at = datetime.utcnow()
    orq.reviewed_by = admin_user_id
    orq.tenant_id = tenant.id

    db.session.commit()

    app = current_app._get_current_object()
    if existing_user:
        _send_new_business_email(app, email, business_name, existing_user.full_name)
    else:
        _send_welcome_email(app, email, business_name, owner_name or email, temp_password,
                            business_type=business_type)

    linked = 'existing account' if existing_user else 'new account'
    return jsonify({
        'message': f'Approved — tenant created and linked to {linked}',
        'tenant': tenant.to_dict(include_subscription=True),
        'existing_user': existing_user is not None,
    }), 201


@admin_bp.route('/onboarding-requests/<int:req_id>/reject', methods=['POST'])
@jwt_required()
@super_admin_required
def reject_onboarding_request(req_id):
    orq = OnboardingRequest.query.get_or_404(req_id)
    if orq.status != 'pending':
        return jsonify({'error': f'Request is already {orq.status}'}), 400

    admin_user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    reason = data.get('reason', '').strip()

    orq.status = 'rejected'
    orq.rejection_reason = reason
    orq.reviewed_at = datetime.utcnow()
    orq.reviewed_by = admin_user_id

    db.session.commit()

    # Optionally notify applicant
    if data.get('notify', True):
        from app.models.onboarding import BUSINESS_TYPE_LABELS
        btype_label = BUSINESS_TYPE_LABELS.get(orq.business_type, orq.business_type)
        msg = Message(
            subject='Update on your CheesePOS application',
            recipients=[orq.email],
            html=f"""
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
              <h2 style="color:#1e293b">Application Update</h2>
              <p>Hi {html_mod.escape(orq.owner_name or orq.email)},</p>
              <p>Thank you for your interest in CheesePOS for <strong>{html_mod.escape(orq.business_name)}</strong>.</p>
              <p>Unfortunately, we are unable to proceed with your application at this time.</p>
              {'<p><strong>Reason:</strong> ' + html_mod.escape(reason) + '</p>' if reason else ''}
              <p>If you have questions, please contact us at <a href="mailto:cheesepossupport@gmail.com">cheesepossupport@gmail.com</a>.</p>
            </div>
            """,
        )
        app = current_app._get_current_object()
        thread = threading.Thread(target=_send_async, args=(app, msg))
        thread.daemon = True
        thread.start()

    return jsonify({'message': 'Request rejected', 'request': orq.to_dict()})
