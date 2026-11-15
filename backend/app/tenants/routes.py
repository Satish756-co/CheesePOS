from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import datetime, timedelta
from app.extensions import db, limiter
from app.models import Tenant, PlatformSetting, Plan, TenantSubscription

tenants_bp = Blueprint('tenants', __name__)


@tenants_bp.route('/register', methods=['POST'])
@limiter.limit("10 per hour")
def register_tenant():
    from app.models import User
    from flask import current_app
    data = request.get_json()

    if not data.get('email') or not data.get('business_name') or not data.get('password'):
        return jsonify({'error': 'Required fields missing'}), 400

    if Tenant.query.filter_by(email=data['email'].lower()).first():
        return jsonify({'error': 'Email already registered'}), 400

    count = Tenant.query.count()
    tenant_code = f"TEN-{str(count + 1).zfill(6)}"
    trial_days = PlatformSetting.get_int('trial_days', current_app.config.get('TRIAL_DAYS', 14))
    trial_end = datetime.utcnow() + timedelta(days=trial_days)

    tenant = Tenant(
        tenant_code=tenant_code,
        business_name=data['business_name'],
        owner_name=data.get('owner_name', ''),
        email=data['email'].lower().strip(),
        phone=data.get('phone', ''),
        business_type=data.get('business_type', 'bar_restaurant'),
        city=data.get('city'),
        state=data.get('state', 'Andhra Pradesh'),
        address=data.get('address'),
        pincode=data.get('pincode'),
        status='trial',
        trial_ends_at=trial_end,
    )
    db.session.add(tenant)
    db.session.flush()

    user = User(
        tenant_id=tenant.id,
        first_name=data.get('owner_name', '').split()[0] if data.get('owner_name') else data['business_name'],
        last_name=' '.join(data.get('owner_name', '').split()[1:]) or 'Owner',
        email=data['email'].lower().strip(),
        phone=data.get('phone'),
        role='owner',
        is_active=True,
    )
    user.set_password(data['password'])
    db.session.add(user)

    db.session.commit()
    return jsonify({
        'message': f'Account created. {trial_days}-day trial started.',
        'tenant': tenant.to_dict(),
    }), 201
