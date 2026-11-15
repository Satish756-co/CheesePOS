from datetime import datetime, timedelta
from app.extensions import db
from app.models.base import TimestampMixin


class DataResetBatch(db.Model):
    __tablename__ = 'data_reset_batches'

    id         = db.Column(db.Integer, primary_key=True)
    tenant_id  = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    reset_by   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    options    = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    status     = db.Column(db.String(20), default='active')  # active | restored | purged

    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'reset_by': self.reset_by,
            'options': self.options,
            'created_at': self.created_at.isoformat(),
            'expires_at': self.expires_at.isoformat(),
            'status': self.status,
        }


class Order(db.Model, TimestampMixin):
    __tablename__ = 'orders'
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'order_number', name='uq_orders_tenant_number'),
    )

    id         = db.Column(db.Integer, primary_key=True)
    tenant_id  = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    order_number = db.Column(db.String(30), nullable=False)
    table_id = db.Column(db.Integer, db.ForeignKey('tables_master.id'), nullable=True)
    order_type = db.Column(db.String(20), default='dine_in')  # dine_in, counter, takeaway, delivery
    status = db.Column(db.String(20), default='open')
    # open, order_placed, preparing, ready, served, billed, cancelled
    waiter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    cashier_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    customer_name = db.Column(db.String(100))
    customer_phone = db.Column(db.String(20))
    guest_count = db.Column(db.Integer, default=1)
    notes = db.Column(db.Text)
    special_instructions = db.Column(db.Text)
    invoice_id     = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=True)
    reset_batch_id = db.Column(db.Integer, db.ForeignKey('data_reset_batches.id'), nullable=True, index=True)

    items = db.relationship('OrderItem', back_populates='order', lazy='dynamic', cascade='all, delete-orphan')
    kots = db.relationship('KOT', back_populates='order', lazy='dynamic')

    def to_dict(self, include_items=False):
        from app.extensions import db as _db
        from app.models.outlet import Outlet, TableMaster
        from app.models.user import User

        outlet = _db.session.get(Outlet, self.outlet_id)
        table_number = None
        if self.table_id:
            t = _db.session.get(TableMaster, self.table_id)
            if t:
                table_number = t.table_number

        waiter_name = None
        if self.waiter_id:
            w = _db.session.get(User, self.waiter_id)
            if w:
                waiter_name = w.full_name

        items_list = list(self.items.all())
        total_amount = sum(float(item.net_amount) for item in items_list)

        data = {
            'id': self.id,
            'order_number': self.order_number,
            'outlet_id': self.outlet_id,
            'outlet_name': outlet.name if outlet else None,
            'table_id': self.table_id,
            'table_number': table_number,
            'order_type': self.order_type,
            'status': self.status,
            'customer_name': self.customer_name,
            'customer_phone': self.customer_phone,
            'guest_count': self.guest_count,
            'notes': self.notes,
            'net_amount': total_amount,
            'total_amount': total_amount,
            'waiter_id': self.waiter_id,
            'waiter_name': waiter_name,
            'created_at': self.created_at.isoformat(),
        }
        if include_items:
            data['items'] = [item.to_dict() for item in items_list]
        return data


class OrderItem(db.Model, TimestampMixin):
    __tablename__ = 'order_items'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=True)
    product_name = db.Column(db.String(200), nullable=False)
    variant_name = db.Column(db.String(50))
    quantity = db.Column(db.Numeric(10, 3), nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    discount_percent = db.Column(db.Numeric(5, 2), default=0)
    discount_amount = db.Column(db.Numeric(10, 2), default=0)
    net_amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(20), default='pending')
    kot_id = db.Column(db.Integer, db.ForeignKey('kots.id'), nullable=True)
    special_instructions = db.Column(db.Text)

    order = db.relationship('Order', back_populates='items')

    def to_dict(self):
        from app.extensions import db as _db
        from app.models.product import Product
        product = _db.session.get(Product, self.product_id)
        return {
            'id': self.id,
            'product_id': self.product_id,
            'variant_id': self.variant_id,
            'product_name': self.product_name,
            'variant_name': self.variant_name,
            'quantity': float(self.quantity),
            'unit_price': float(self.unit_price),
            'discount_percent': float(self.discount_percent),
            'net_amount': float(self.net_amount),
            'tax_category': product.tax_category if product else None,
            'status': self.status,
            'special_instructions': self.special_instructions,
        }


class KOT(db.Model, TimestampMixin):
    __tablename__ = 'kots'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    kot_number = db.Column(db.String(30), nullable=False)
    table_id = db.Column(db.Integer, db.ForeignKey('tables_master.id'), nullable=True)
    station = db.Column(db.String(50), default='kitchen')  # kitchen, bar
    status = db.Column(db.String(20), default='new')  # new, accepted, preparing, ready, served, cancelled
    waiter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    accepted_at = db.Column(db.DateTime)
    preparing_at = db.Column(db.DateTime)
    ready_at = db.Column(db.DateTime)
    served_at = db.Column(db.DateTime)
    notes          = db.Column(db.Text)
    reset_batch_id = db.Column(db.Integer, db.ForeignKey('data_reset_batches.id'), nullable=True, index=True)

    order = db.relationship('Order', back_populates='kots')
    items = db.relationship('KOTItem', back_populates='kot', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self, include_items=True):
        data = {
            'id': self.id,
            'kot_number': self.kot_number,
            'order_id': self.order_id,
            'table_id': self.table_id,
            'station': self.station,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
            'accepted_at': self.accepted_at.isoformat() if self.accepted_at else None,
            'ready_at': self.ready_at.isoformat() if self.ready_at else None,
        }
        if include_items:
            data['items'] = [item.to_dict() for item in self.items.all()]
        return data


class KOTItem(db.Model, TimestampMixin):
    __tablename__ = 'kot_items'

    id = db.Column(db.Integer, primary_key=True)
    kot_id = db.Column(db.Integer, db.ForeignKey('kots.id'), nullable=False)
    order_item_id = db.Column(db.Integer, db.ForeignKey('order_items.id'), nullable=False)
    product_name = db.Column(db.String(200), nullable=False)
    variant_name = db.Column(db.String(50))
    quantity = db.Column(db.Numeric(10, 3), nullable=False)
    special_instructions = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')

    kot = db.relationship('KOT', back_populates='items')

    def to_dict(self):
        return {
            'id': self.id,
            'product_name': self.product_name,
            'variant_name': self.variant_name,
            'quantity': float(self.quantity),
            'special_instructions': self.special_instructions,
            'status': self.status,
        }


class Invoice(db.Model, TimestampMixin):
    __tablename__ = 'invoices'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    invoice_number = db.Column(db.String(30), nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=True)
    billing_type = db.Column(db.String(20), default='counter')  # counter, table, takeaway
    customer_name = db.Column(db.String(100))
    customer_phone = db.Column(db.String(20))
    customer_gstin = db.Column(db.String(20))
    cashier_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    shift_id = db.Column(db.Integer, db.ForeignKey('shifts.id'), nullable=True)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)
    discount_amount = db.Column(db.Numeric(10, 2), default=0)
    taxable_amount = db.Column(db.Numeric(10, 2), nullable=False)
    tax_breakdown = db.Column(db.JSON, default=dict)
    tax_amount = db.Column(db.Numeric(10, 2), default=0)
    service_charge = db.Column(db.Numeric(10, 2), default=0)
    round_off = db.Column(db.Numeric(10, 2), default=0)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    paid_amount = db.Column(db.Numeric(10, 2), default=0)
    change_amount = db.Column(db.Numeric(10, 2), default=0)
    status = db.Column(db.String(20), default='paid')  # paid, unpaid, cancelled, refunded
    payment_status = db.Column(db.String(20), default='pending')  # pending, partial, paid
    cancelled_at = db.Column(db.DateTime)
    cancelled_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    cancellation_reason = db.Column(db.Text)
    notes = db.Column(db.Text)
    idempotency_key = db.Column(db.String(100), unique=True)
    reset_batch_id  = db.Column(db.Integer, db.ForeignKey('data_reset_batches.id'), nullable=True, index=True)

    outlet   = db.relationship('Outlet', back_populates='invoices')
    items = db.relationship('InvoiceItem', back_populates='invoice', lazy='dynamic', cascade='all, delete-orphan')
    payments = db.relationship('BillPayment', back_populates='invoice', lazy='dynamic')

    def to_dict(self, include_items=False):
        outlet = self.outlet  # relationship already loaded
        data = {
            'id': self.id,
            'invoice_number': self.invoice_number,
            'billing_type': self.billing_type,
            'order_id': self.order_id,
            'customer_name': self.customer_name,
            'customer_phone': self.customer_phone,
            'subtotal': float(self.subtotal),
            'discount_amount': float(self.discount_amount),
            'taxable_amount': float(self.taxable_amount),
            'tax_breakdown': self.tax_breakdown,
            'tax_amount': float(self.tax_amount),
            'service_charge': float(self.service_charge),
            'round_off': float(self.round_off),
            'total_amount': float(self.total_amount),
            'paid_amount': float(self.paid_amount),
            'change_amount': float(self.change_amount),
            'status': self.status,
            'payment_status': self.payment_status,
            'items_count': self.items.count(),
            'cancelled_at': self.cancelled_at.isoformat() if self.cancelled_at else None,
            'cancellation_reason': self.cancellation_reason,
            'created_at': self.created_at.isoformat(),
            'outlet': {
                'id': outlet.id,
                'name': outlet.name,
                'address': outlet.address or '',
                'city': outlet.city or '',
                'phone': outlet.phone or '',
                'gstin': outlet.gstin or '',
                'printer_config': outlet.printer_config or {},
                'receipt_config': outlet.receipt_config or {},
            } if outlet else None,
        }
        if include_items:
            data['items'] = [item.to_dict() for item in self.items.all()]
            data['payments'] = [p.to_dict() for p in self.payments.all()]
        return data


class InvoiceItem(db.Model, TimestampMixin):
    __tablename__ = 'invoice_items'

    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=True)
    product_name = db.Column(db.String(200), nullable=False)
    variant_name = db.Column(db.String(50))
    hsn_code = db.Column(db.String(20))
    quantity = db.Column(db.Numeric(10, 3), nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    discount_percent = db.Column(db.Numeric(5, 2), default=0)
    discount_amount = db.Column(db.Numeric(10, 2), default=0)
    taxable_amount = db.Column(db.Numeric(10, 2), nullable=False)
    tax_category = db.Column(db.String(50))
    tax_amount = db.Column(db.Numeric(10, 2), default=0)
    tax_rate = db.Column(db.Numeric(5, 2), default=0)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)

    invoice = db.relationship('Invoice', back_populates='items')

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product_name,
            'variant_name': self.variant_name,
            'quantity': float(self.quantity),
            'unit_price': float(self.unit_price),
            'discount_percent': float(self.discount_percent),
            'taxable_amount': float(self.taxable_amount),
            'tax_amount': float(self.tax_amount),
            'tax_rate': float(self.tax_rate),
            'total_amount': float(self.total_amount),
        }


class BillPayment(db.Model, TimestampMixin):
    __tablename__ = 'bill_payments'

    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    payment_mode = db.Column(db.String(20), nullable=False)  # cash, upi, card, credit, split
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    reference_number = db.Column(db.String(100))
    upi_id = db.Column(db.String(100))
    card_last4 = db.Column(db.String(4))
    status = db.Column(db.String(20), default='completed')

    invoice = db.relationship('Invoice', back_populates='payments')

    def to_dict(self):
        return {
            'id': self.id,
            'payment_mode': self.payment_mode,
            'amount': float(self.amount),
            'reference_number': self.reference_number,
            'status': self.status,
        }
