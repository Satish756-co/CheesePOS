from datetime import datetime
from app.extensions import db
from app.models.base import TimestampMixin

BUSINESS_TYPES = [
    'bar_restaurant',
    'saloon',
    'daily_store',
    'scanning_lab',
    'pharmacy',
    'retail_shop',
    'hr_operations',
    'other',
]

BUSINESS_TYPE_LABELS = {
    'bar_restaurant': 'Bar & Restaurant',
    'saloon':         'Saloon / Spa',
    'daily_store':    'Daily Store / Kirana',
    'scanning_lab':   'Scanning Center / Lab',
    'pharmacy':       'Pharmacy',
    'retail_shop':    'Retail Shop',
    'hr_operations':  'HR Operations',
    'other':          'Other',
}


class OnboardingRequest(db.Model, TimestampMixin):
    __tablename__ = 'onboarding_requests'

    id = db.Column(db.Integer, primary_key=True)
    business_name = db.Column(db.String(200), nullable=False)
    owner_name = db.Column(db.String(100))
    email = db.Column(db.String(150), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    business_type = db.Column(db.String(50), default='bar_restaurant')
    description = db.Column(db.Text)
    city = db.Column(db.String(100))
    state = db.Column(db.String(100))
    country = db.Column(db.String(100))
    pincode = db.Column(db.String(10))
    status = db.Column(db.String(20), default='pending')  # pending | approved | rejected
    rejection_reason = db.Column(db.Text)
    reviewed_at = db.Column(db.DateTime)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=True)  # set on approval

    def to_dict(self):
        return {
            'id': self.id,
            'business_name': self.business_name,
            'owner_name': self.owner_name,
            'email': self.email,
            'phone': self.phone,
            'business_type': self.business_type,
            'business_type_label': BUSINESS_TYPE_LABELS.get(self.business_type, self.business_type),
            'description': self.description,
            'city': self.city,
            'state': self.state,
            'country': self.country,
            'pincode': self.pincode,
            'status': self.status,
            'rejection_reason': self.rejection_reason,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'tenant_id': self.tenant_id,
            'created_at': self.created_at.isoformat(),
        }
