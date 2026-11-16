from datetime import datetime
from app.extensions import db
from app.models.base import TimestampMixin


class Plan(db.Model, TimestampMixin):
    __tablename__ = 'plans'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    slug = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text)
    price_monthly = db.Column(db.Numeric(10, 2), nullable=False)
    price_yearly = db.Column(db.Numeric(10, 2), nullable=False)
    max_outlets = db.Column(db.Integer, nullable=False, default=1)
    max_users = db.Column(db.Integer, nullable=False, default=3)
    features = db.Column(db.JSON, default=dict)
    is_active = db.Column(db.Boolean, default=True)
    display_order = db.Column(db.Integer, default=0)

    subscriptions = db.relationship('TenantSubscription', back_populates='plan', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            'price_monthly': float(self.price_monthly),
            'price_yearly': float(self.price_yearly),
            'max_outlets': self.max_outlets,
            'max_users': self.max_users,
            'features': self.features,
            'is_active': self.is_active,
        }


class Tenant(db.Model, TimestampMixin):
    __tablename__ = 'tenants'

    id = db.Column(db.Integer, primary_key=True)
    tenant_code = db.Column(db.String(20), unique=True, nullable=False)
    business_name = db.Column(db.String(200), nullable=False)
    owner_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    business_type = db.Column(db.String(50), default='bar_restaurant')
    gstin = db.Column(db.String(20))
    fssai_number = db.Column(db.String(30))
    excise_license = db.Column(db.String(50))
    address = db.Column(db.Text)
    city = db.Column(db.String(100))
    state = db.Column(db.String(100))
    pincode = db.Column(db.String(10))
    logo_url = db.Column(db.String(500))
    status = db.Column(db.String(20), default='trial')  # trial, active, suspended, expired, cancelled
    is_verified = db.Column(db.Boolean, default=False)
    trial_ends_at = db.Column(db.DateTime)
    notes = db.Column(db.Text)
    custom_max_outlets = db.Column(db.Integer, nullable=True)
    custom_max_users = db.Column(db.Integer, nullable=True)
    # Soft-deletion cooling period
    deletion_status = db.Column(db.String(20), nullable=True)   # pending_deletion | purged
    deleted_at = db.Column(db.DateTime, nullable=True)
    deletion_expires_at = db.Column(db.DateTime, nullable=True)

    outlets = db.relationship('Outlet', back_populates='tenant', lazy='dynamic')
    users = db.relationship('User', back_populates='tenant', lazy='dynamic')
    subscriptions = db.relationship('TenantSubscription', back_populates='tenant', lazy='dynamic')
    support_tickets = db.relationship('SupportTicket', back_populates='tenant', lazy='dynamic')

    def to_dict(self, include_subscription=False):
        data = {
            'id': self.id,
            'tenant_code': self.tenant_code,
            'business_name': self.business_name,
            'owner_name': self.owner_name,
            'email': self.email,
            'phone': self.phone,
            'business_type': self.business_type,
            'gstin': self.gstin,
            'city': self.city,
            'state': self.state,
            'status': self.status,
            'is_verified': self.is_verified,
            'trial_ends_at': self.trial_ends_at.isoformat() if self.trial_ends_at else None,
            'created_at': self.created_at.isoformat(),
            'custom_max_outlets': self.custom_max_outlets,
            'custom_max_users': self.custom_max_users,
            'deletion_status': self.deletion_status,
            'deleted_at': self.deleted_at.isoformat() if self.deleted_at else None,
            'deletion_expires_at': self.deletion_expires_at.isoformat() if self.deletion_expires_at else None,
        }
        if include_subscription:
            sub = self.active_subscription
            data['subscription'] = sub.to_dict() if sub else None
        return data

    @property
    def active_subscription(self):
        return TenantSubscription.query.filter_by(
            tenant_id=self.id, status='active'
        ).order_by(TenantSubscription.ends_at.desc()).first()


class TenantSubscription(db.Model, TimestampMixin):
    __tablename__ = 'tenant_subscriptions'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    plan_id = db.Column(db.Integer, db.ForeignKey('plans.id'), nullable=False)
    billing_cycle = db.Column(db.String(20), default='monthly')  # monthly, yearly
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, active, expired, cancelled
    starts_at = db.Column(db.DateTime, nullable=False)
    ends_at = db.Column(db.DateTime, nullable=False)
    grace_ends_at = db.Column(db.DateTime)
    razorpay_subscription_id = db.Column(db.String(100))
    cancelled_at = db.Column(db.DateTime)
    cancellation_reason = db.Column(db.Text)

    tenant = db.relationship('Tenant', back_populates='subscriptions')
    plan = db.relationship('Plan', back_populates='subscriptions')
    payments = db.relationship('SubscriptionPayment', back_populates='subscription', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'plan': self.plan.to_dict() if self.plan else None,
            'billing_cycle': self.billing_cycle,
            'amount': float(self.amount),
            'status': self.status,
            'starts_at': self.starts_at.isoformat(),
            'ends_at': self.ends_at.isoformat(),
            'grace_ends_at': self.grace_ends_at.isoformat() if self.grace_ends_at else None,
        }


class SubscriptionPayment(db.Model, TimestampMixin):
    __tablename__ = 'subscription_payments'

    id = db.Column(db.Integer, primary_key=True)
    subscription_id = db.Column(db.Integer, db.ForeignKey('tenant_subscriptions.id'), nullable=False)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    gst_amount = db.Column(db.Numeric(10, 2), default=0)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(10), default='INR')
    status = db.Column(db.String(20), default='pending')  # pending, paid, failed, refunded
    payment_method = db.Column(db.String(50))
    razorpay_order_id = db.Column(db.String(100))
    razorpay_payment_id = db.Column(db.String(100))
    razorpay_signature = db.Column(db.String(200))
    invoice_number = db.Column(db.String(50), unique=True)
    paid_at = db.Column(db.DateTime)
    failure_reason = db.Column(db.Text)

    subscription = db.relationship('TenantSubscription', back_populates='payments')

    def to_dict(self):
        return {
            'id': self.id,
            'amount': float(self.amount),
            'gst_amount': float(self.gst_amount),
            'total_amount': float(self.total_amount),
            'currency': self.currency,
            'status': self.status,
            'payment_method': self.payment_method,
            'invoice_number': self.invoice_number,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
            'created_at': self.created_at.isoformat(),
        }


class PlatformSetting(db.Model):
    __tablename__ = 'platform_settings'

    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @classmethod
    def get(cls, key, default=None):
        row = cls.query.get(key)
        return row.value if row else default

    @classmethod
    def get_int(cls, key, default=0):
        val = cls.get(key)
        try:
            return int(val) if val is not None else default
        except (ValueError, TypeError):
            return default

    @classmethod
    def get_bool(cls, key, default=False):
        val = cls.get(key)
        if val is None:
            return default
        return val.lower() in ('true', '1', 'yes')

    @classmethod
    def set(cls, key, value):
        row = cls.query.get(key)
        if row:
            row.value = str(value)
            row.updated_at = datetime.utcnow()
        else:
            row = cls(key=key, value=str(value))
            db.session.add(row)

