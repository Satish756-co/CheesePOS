from app.extensions import db
from app.models.base import TimestampMixin


class Outlet(db.Model, TimestampMixin):
    __tablename__ = 'outlets'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_code = db.Column(db.String(20), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    outlet_type = db.Column(db.String(50), default='bar_restaurant')  # bar, restaurant, bar_restaurant
    phone = db.Column(db.String(20))
    email = db.Column(db.String(150))
    address = db.Column(db.Text)
    city = db.Column(db.String(100))
    state = db.Column(db.String(100))
    pincode = db.Column(db.String(10))
    gstin = db.Column(db.String(20))
    fssai_number = db.Column(db.String(30))
    excise_license = db.Column(db.String(50))
    excise_license_type = db.Column(db.String(50))
    tax_config = db.Column(db.JSON, default=dict)
    receipt_config = db.Column(db.JSON, default=dict)
    printer_config = db.Column(db.JSON, default=dict)
    is_active = db.Column(db.Boolean, default=True)
    opens_at = db.Column(db.String(10))
    closes_at = db.Column(db.String(10))

    tenant = db.relationship('Tenant', back_populates='outlets')
    user_assignments = db.relationship('UserOutlet', back_populates='outlet', lazy='dynamic')
    tables = db.relationship('TableMaster', back_populates='outlet', lazy='dynamic')
    products = db.relationship('Product', back_populates='outlet', lazy='dynamic')
    invoices = db.relationship('Invoice', back_populates='outlet', lazy='dynamic')
    stock_balances = db.relationship('StockBalance', back_populates='outlet', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'outlet_code': self.outlet_code,
            'name': self.name,
            'outlet_type': self.outlet_type,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'city': self.city,
            'state': self.state,
            'gstin': self.gstin,
            'excise_license': self.excise_license,
            'tax_config': self.tax_config,
            'printer_config': self.printer_config or {},
            'receipt_config': self.receipt_config or {},
            'is_active': self.is_active,
            'opens_at': self.opens_at,
            'closes_at': self.closes_at,
        }


class TableMaster(db.Model, TimestampMixin):
    __tablename__ = 'tables_master'

    id = db.Column(db.Integer, primary_key=True)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    table_number = db.Column(db.String(20), nullable=False)
    floor_section = db.Column(db.String(50), default='Main Hall')
    seating_capacity = db.Column(db.Integer, default=4)
    status = db.Column(db.String(20), default='available')
    # available, occupied, order_placed, preparing, ready, billed, reserved, cleaning
    current_order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=True)
    reservation_name = db.Column(db.String(100))
    reservation_time = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)

    outlet = db.relationship('Outlet', back_populates='tables')

    def to_dict(self):
        return {
            'id': self.id,
            'outlet_id': self.outlet_id,
            'table_number': self.table_number,
            'floor_section': self.floor_section,
            'seating_capacity': self.seating_capacity,
            'status': self.status,
            'current_order_id': self.current_order_id,
            'reservation_name': self.reservation_name,
        }


class Shift(db.Model, TimestampMixin):
    __tablename__ = 'shifts'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    cashier_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    opening_cash = db.Column(db.Numeric(10, 2), default=0)
    closing_cash = db.Column(db.Numeric(10, 2))
    cash_sales = db.Column(db.Numeric(10, 2), default=0)
    upi_sales = db.Column(db.Numeric(10, 2), default=0)
    card_sales = db.Column(db.Numeric(10, 2), default=0)
    total_bills = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='open')  # open, closed
    opened_at = db.Column(db.DateTime)
    closed_at = db.Column(db.DateTime)
    notes = db.Column(db.Text)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    def to_dict(self):
        return {
            'id': self.id,
            'outlet_id': self.outlet_id,
            'opening_cash': float(self.opening_cash),
            'closing_cash': float(self.closing_cash) if self.closing_cash else None,
            'cash_sales': float(self.cash_sales),
            'upi_sales': float(self.upi_sales),
            'card_sales': float(self.card_sales),
            'total_bills': self.total_bills,
            'status': self.status,
            'opened_at': self.opened_at.isoformat() if self.opened_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
        }
