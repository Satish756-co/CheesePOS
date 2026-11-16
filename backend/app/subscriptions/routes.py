from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import date
from app.extensions import db
from app.models import Tenant, Plan, TenantSubscription, SubscriptionPayment, PlatformSetting
from app.auth.decorators import tenant_required

subscriptions_bp = Blueprint('subscriptions', __name__)


@subscriptions_bp.route('/plans', methods=['GET'])
def list_public_plans():
    plans = Plan.query.filter_by(is_active=True).order_by(Plan.display_order).all()
    return jsonify([p.to_dict() for p in plans])


@subscriptions_bp.route('/config', methods=['GET'])
def get_public_config():
    trial_days = PlatformSetting.get_int('trial_days', 14)
    show_pricing = PlatformSetting.get_bool('show_pricing', False)
    return jsonify({'trial_days': trial_days, 'show_pricing': show_pricing})


@subscriptions_bp.route('/current', methods=['GET'])
@jwt_required()
@tenant_required
def get_current_subscription():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    tenant = Tenant.query.get(tenant_id)
    sub = tenant.active_subscription
    return jsonify({
        'tenant': tenant.to_dict(),
        'subscription': sub.to_dict() if sub else None,
    })


@subscriptions_bp.route('/create-order', methods=['POST'])
@jwt_required()
@tenant_required
def create_payment_order():
    import razorpay
    from flask import current_app
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    data = request.get_json()
    if not data or not data.get('plan_id'):
        return jsonify({'error': 'plan_id is required'}), 400

    plan = Plan.query.get_or_404(data['plan_id'])
    billing_cycle = data.get('billing_cycle', 'monthly')
    amount = plan.price_yearly if billing_cycle == 'yearly' else plan.price_monthly
    gst_amount = amount * 18 / 100
    total_amount = amount + gst_amount

    try:
        client = razorpay.Client(auth=(
            current_app.config['RAZORPAY_KEY_ID'],
            current_app.config['RAZORPAY_KEY_SECRET'],
        ))
        order = client.order.create({
            'amount': int(total_amount * 100),
            'currency': 'INR',
            'receipt': f'sub_{tenant_id}_{plan.id}',
            'notes': {
                'tenant_id': str(tenant_id),
                'plan_id': str(plan.id),
                'billing_cycle': billing_cycle,
            }
        })
        return jsonify({
            'order_id': order['id'],
            'amount': float(total_amount),
            'currency': 'INR',
            'key': current_app.config['RAZORPAY_KEY_ID'],
            'plan': plan.to_dict(),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@subscriptions_bp.route('/verify-payment', methods=['POST'])
@jwt_required()
@tenant_required
def verify_payment():
    import razorpay
    import hmac
    import hashlib
    from flask import current_app
    from datetime import timedelta

    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    data = request.get_json()

    razorpay_order_id = data.get('razorpay_order_id')
    razorpay_payment_id = data.get('razorpay_payment_id')
    razorpay_signature = data.get('razorpay_signature')
    plan_id = data.get('plan_id')
    billing_cycle = data.get('billing_cycle', 'monthly')

    # Verify signature
    secret = current_app.config['RAZORPAY_KEY_SECRET']
    expected = hmac.new(
        secret.encode(),
        f"{razorpay_order_id}|{razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()

    if expected != razorpay_signature:
        return jsonify({'error': 'Invalid payment signature'}), 400

    plan = Plan.query.get_or_404(plan_id)
    amount = plan.price_yearly if billing_cycle == 'yearly' else plan.price_monthly
    gst_amount = amount * 18 / 100
    total_amount = amount + gst_amount

    now = __import__('datetime').datetime.utcnow()
    ends_at = now + (timedelta(days=365) if billing_cycle == 'yearly' else timedelta(days=30))

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
    db.session.flush()

    payment = SubscriptionPayment(
        subscription_id=sub.id,
        tenant_id=tenant_id,
        amount=amount,
        gst_amount=gst_amount,
        total_amount=total_amount,
        currency='INR',
        status='paid',
        razorpay_order_id=razorpay_order_id,
        razorpay_payment_id=razorpay_payment_id,
        razorpay_signature=razorpay_signature,
        paid_at=now,
    )
    db.session.add(payment)

    tenant = Tenant.query.get(tenant_id)
    tenant.status = 'active'

    db.session.commit()
    return jsonify({'message': 'Payment verified', 'subscription': sub.to_dict()})
