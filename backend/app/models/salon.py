from app.extensions import db
from app.models.base import TimestampMixin


class SalonServiceCategory(db.Model, TimestampMixin):
    __tablename__ = 'salon_service_categories'
    id         = db.Column(db.Integer, primary_key=True)
    tenant_id  = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    name       = db.Column(db.String(100), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    is_active  = db.Column(db.Boolean, default=True)
    services   = db.relationship('SalonService', backref='category', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name,
            'sort_order': self.sort_order, 'is_active': self.is_active,
        }


class SalonService(db.Model, TimestampMixin):
    __tablename__ = 'salon_services'
    id               = db.Column(db.Integer, primary_key=True)
    tenant_id        = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    category_id      = db.Column(db.Integer, db.ForeignKey('salon_service_categories.id'), nullable=True)
    name             = db.Column(db.String(150), nullable=False)
    description      = db.Column(db.Text)
    price            = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    duration_minutes = db.Column(db.Integer, nullable=False, default=30)
    commission_pct   = db.Column(db.Numeric(5, 2), default=0)
    is_active        = db.Column(db.Boolean, default=True)
    __table_args__ = (
        db.Index('ix_salon_services_tenant', 'tenant_id'),
        db.Index('ix_salon_services_category', 'category_id'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None,
            'name': self.name,
            'description': self.description,
            'price': float(self.price),
            'duration_minutes': self.duration_minutes,
            'commission_pct': float(self.commission_pct or 0),
            'is_active': self.is_active,
        }


class SalonPackage(db.Model, TimestampMixin):
    __tablename__ = 'salon_packages'
    id          = db.Column(db.Integer, primary_key=True)
    tenant_id   = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    name        = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text)
    price       = db.Column(db.Numeric(10, 2), nullable=False)
    is_active   = db.Column(db.Boolean, default=True)
    items       = db.relationship(
        'SalonPackageService', backref='package',
        lazy='dynamic', cascade='all, delete-orphan',
    )

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'description': self.description,
            'price': float(self.price), 'is_active': self.is_active,
            'services': [
                {'service_id': i.service_id, 'service_name': i.service.name if i.service else None}
                for i in self.items.all()
            ],
        }


class SalonPackageService(db.Model):
    __tablename__ = 'salon_package_services'
    id         = db.Column(db.Integer, primary_key=True)
    package_id = db.Column(db.Integer, db.ForeignKey('salon_packages.id', ondelete='CASCADE'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('salon_services.id'), nullable=False)
    service    = db.relationship('SalonService')
    __table_args__ = (db.UniqueConstraint('package_id', 'service_id'),)


class SalonCoupon(db.Model, TimestampMixin):
    __tablename__ = 'salon_coupons'
    id                  = db.Column(db.Integer, primary_key=True)
    tenant_id           = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    code                = db.Column(db.String(50), nullable=False)
    name                = db.Column(db.String(100))
    discount_type       = db.Column(db.String(20), nullable=False)   # percent / flat
    discount_value      = db.Column(db.Numeric(10, 2), nullable=False)
    min_bill_amount     = db.Column(db.Numeric(10, 2), default=0)
    max_discount        = db.Column(db.Numeric(10, 2))
    valid_from          = db.Column(db.Date)
    valid_until         = db.Column(db.Date)
    usage_limit         = db.Column(db.Integer)
    used_count          = db.Column(db.Integer, default=0)
    applies_to          = db.Column(db.String(20), default='all')    # all / services / packages
    allowed_service_ids = db.Column(db.JSON, default=list)
    allowed_package_ids = db.Column(db.JSON, default=list)
    is_active           = db.Column(db.Boolean, default=True)
    outlet_id           = db.Column(db.Integer, db.ForeignKey('outlets.id', ondelete='SET NULL'), nullable=True)  # None = all outlets
    __table_args__ = (db.UniqueConstraint('tenant_id', 'code'),)

    outlet = db.relationship('Outlet', foreign_keys=[outlet_id])

    def to_dict(self):
        return {
            'id': self.id, 'code': self.code, 'name': self.name,
            'discount_type': self.discount_type,
            'discount_value': float(self.discount_value),
            'min_bill_amount': float(self.min_bill_amount or 0),
            'max_discount': float(self.max_discount) if self.max_discount else None,
            'valid_from': self.valid_from.isoformat() if self.valid_from else None,
            'valid_until': self.valid_until.isoformat() if self.valid_until else None,
            'usage_limit': self.usage_limit,
            'used_count': self.used_count,
            'applies_to': self.applies_to,
            'allowed_service_ids': self.allowed_service_ids or [],
            'allowed_package_ids': self.allowed_package_ids or [],
            'is_active': self.is_active,
            'outlet_id': self.outlet_id,
            'outlet_name': self.outlet.name if self.outlet else None,
        }


class SalonBill(db.Model, TimestampMixin):
    __tablename__ = 'salon_bills'
    id                = db.Column(db.Integer, primary_key=True)
    tenant_id         = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_id         = db.Column(db.Integer, db.ForeignKey('outlets.id'))
    bill_number       = db.Column(db.String(30), nullable=False)
    customer_name     = db.Column(db.String(100))
    customer_phone    = db.Column(db.String(20))
    staff_id          = db.Column(db.Integer, db.ForeignKey('users.id'))
    subtotal          = db.Column(db.Numeric(10, 2), default=0)
    discount_amount   = db.Column(db.Numeric(10, 2), default=0)
    coupon_id         = db.Column(db.Integer, db.ForeignKey('salon_coupons.id'))
    coupon_code       = db.Column(db.String(50))
    coupon_discount   = db.Column(db.Numeric(10, 2), default=0)
    total             = db.Column(db.Numeric(10, 2), default=0)
    payment_method    = db.Column(db.String(20), default='cash')
    payment_reference = db.Column(db.String(100))
    status            = db.Column(db.String(20), default='paid')
    notes             = db.Column(db.Text)
    items             = db.relationship(
        'SalonBillItem', backref='bill',
        lazy='dynamic', cascade='all, delete-orphan',
    )
    staff             = db.relationship('User', foreign_keys=[staff_id])
    outlet            = db.relationship('Outlet', foreign_keys=[outlet_id])
    __table_args__ = (
        db.Index('ix_salon_bills_tenant_created', 'tenant_id', 'created_at'),
        db.Index('ix_salon_bills_tenant_status', 'tenant_id', 'status'),
        db.Index('ix_salon_bills_staff', 'staff_id'),
        db.Index('ix_salon_bills_outlet', 'outlet_id'),
    )

    def to_dict(self, include_items=False):
        d = {
            'id': self.id,
            'bill_number': self.bill_number,
            'customer_name': self.customer_name,
            'customer_phone': self.customer_phone,
            'staff_id': self.staff_id,
            'staff_name': self.staff.full_name if self.staff else None,
            'outlet_id': self.outlet_id,
            'outlet_name': self.outlet.name if self.outlet else None,
            'subtotal': float(self.subtotal),
            'discount_amount': float(self.discount_amount),
            'coupon_code': self.coupon_code,
            'coupon_discount': float(self.coupon_discount),
            'total': float(self.total),
            'payment_method': self.payment_method,
            'payment_reference': self.payment_reference,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
        }
        if include_items:
            d['items'] = [i.to_dict() for i in self.items.all()]
        return d


class SalonBillItem(db.Model):
    __tablename__ = 'salon_bill_items'
    id                = db.Column(db.Integer, primary_key=True)
    bill_id           = db.Column(db.Integer, db.ForeignKey('salon_bills.id', ondelete='CASCADE'), nullable=False)
    service_id        = db.Column(db.Integer, db.ForeignKey('salon_services.id'))
    package_id        = db.Column(db.Integer, db.ForeignKey('salon_packages.id'))
    item_type         = db.Column(db.String(20), nullable=False)   # service / package
    item_name         = db.Column(db.String(150), nullable=False)
    price             = db.Column(db.Numeric(10, 2), nullable=False)
    quantity          = db.Column(db.Integer, default=1)
    commission_pct    = db.Column(db.Numeric(5, 2), default=0)
    commission_amount = db.Column(db.Numeric(10, 2), default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'service_id': self.service_id,
            'package_id': self.package_id,
            'item_type': self.item_type,
            'item_name': self.item_name,
            'price': float(self.price),
            'quantity': self.quantity,
            'commission_pct': float(self.commission_pct or 0),
            'commission_amount': float(self.commission_amount or 0),
        }


class SalonServiceOutletPrice(db.Model):
    """Per-outlet price override for a salon service."""
    __tablename__ = 'salon_service_outlet_prices'
    id         = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('salon_services.id', ondelete='CASCADE'), nullable=False)
    outlet_id  = db.Column(db.Integer, db.ForeignKey('outlets.id', ondelete='CASCADE'), nullable=False)
    price      = db.Column(db.Numeric(10, 2), nullable=False)
    __table_args__ = (db.UniqueConstraint('service_id', 'outlet_id'),)


class SalonPackageOutletPrice(db.Model):
    """Per-outlet price override for a salon package."""
    __tablename__ = 'salon_package_outlet_prices'
    id         = db.Column(db.Integer, primary_key=True)
    package_id = db.Column(db.Integer, db.ForeignKey('salon_packages.id', ondelete='CASCADE'), nullable=False)
    outlet_id  = db.Column(db.Integer, db.ForeignKey('outlets.id', ondelete='CASCADE'), nullable=False)
    price      = db.Column(db.Numeric(10, 2), nullable=False)
    __table_args__ = (db.UniqueConstraint('package_id', 'outlet_id'),)


class SalonBillCancelRequest(db.Model):
    """Approval request for bill cancellation (from non-manager roles)."""
    __tablename__ = 'salon_bill_cancel_requests'
    id           = db.Column(db.Integer, primary_key=True)
    tenant_id    = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    bill_id      = db.Column(db.Integer, db.ForeignKey('salon_bills.id', ondelete='CASCADE'), nullable=False)
    requested_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reason       = db.Column(db.String(500))
    status       = db.Column(db.String(20), default='pending')   # pending | approved | rejected
    reviewed_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    review_note  = db.Column(db.String(500))
    created_at   = db.Column(db.DateTime, server_default=db.func.now())

    bill      = db.relationship('SalonBill',  foreign_keys=[bill_id])
    requester = db.relationship('User', foreign_keys=[requested_by])
    reviewer  = db.relationship('User', foreign_keys=[reviewed_by])

    def to_dict(self):
        return {
            'id': self.id,
            'bill_id': self.bill_id,
            'bill_number': self.bill.bill_number if self.bill else None,
            'bill_total': float(self.bill.total) if self.bill else None,
            'customer_name': self.bill.customer_name if self.bill else None,
            'requested_by_id': self.requested_by,
            'requested_by_name': self.requester.full_name if self.requester else None,
            'reason': self.reason,
            'status': self.status,
            'review_note': self.review_note,
            'reviewed_by_name': self.reviewer.full_name if self.reviewer else None,
            'created_at': self.created_at.isoformat(),
        }
