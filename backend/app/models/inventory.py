from app.extensions import db
from app.models.base import TimestampMixin


class Supplier(db.Model, TimestampMixin):
    __tablename__ = 'suppliers'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    supplier_code = db.Column(db.String(20))
    name = db.Column(db.String(200), nullable=False)
    contact_person = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(150))
    address = db.Column(db.Text)
    gstin = db.Column(db.String(20))
    payment_terms = db.Column(db.Integer, default=30)
    opening_balance = db.Column(db.Numeric(10, 2), default=0)
    current_balance = db.Column(db.Numeric(10, 2), default=0)
    is_active = db.Column(db.Boolean, default=True)
    notes = db.Column(db.Text)

    purchases = db.relationship('Purchase', back_populates='supplier', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'supplier_code': self.supplier_code,
            'name': self.name,
            'contact_person': self.contact_person,
            'phone': self.phone,
            'email': self.email,
            'gstin': self.gstin,
            'current_balance': float(self.current_balance),
            'is_active': self.is_active,
        }


class Purchase(db.Model, TimestampMixin):
    __tablename__ = 'purchases'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)
    purchase_number = db.Column(db.String(30), nullable=False)
    invoice_number = db.Column(db.String(50))
    invoice_date = db.Column(db.Date)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)
    tax_amount = db.Column(db.Numeric(10, 2), default=0)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    paid_amount = db.Column(db.Numeric(10, 2), default=0)
    balance_amount = db.Column(db.Numeric(10, 2), default=0)
    status = db.Column(db.String(20), default='pending')  # pending, approved, received, cancelled
    payment_status = db.Column(db.String(20), default='unpaid')  # unpaid, partial, paid
    received_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    notes          = db.Column(db.Text)
    reset_batch_id = db.Column(db.Integer, db.ForeignKey('data_reset_batches.id'), nullable=True, index=True)

    supplier = db.relationship('Supplier', back_populates='purchases')
    items = db.relationship('PurchaseItem', back_populates='purchase', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self, include_items=False):
        data = {
            'id': self.id,
            'purchase_number': self.purchase_number,
            'invoice_number': self.invoice_number,
            'invoice_date': self.invoice_date.isoformat() if self.invoice_date else None,
            'supplier_id': self.supplier_id,
            'supplier_name': self.supplier.name if self.supplier else None,
            'outlet_id': self.outlet_id,
            'subtotal': float(self.subtotal),
            'tax_amount': float(self.tax_amount),
            'total_amount': float(self.total_amount),
            'paid_amount': float(self.paid_amount),
            'balance_amount': float(self.balance_amount),
            'status': self.status,
            'payment_status': self.payment_status,
            'created_at': self.created_at.isoformat(),
        }
        if include_items:
            data['items'] = [item.to_dict() for item in self.items.all()]
        return data


class PurchaseItem(db.Model, TimestampMixin):
    __tablename__ = 'purchase_items'

    id = db.Column(db.Integer, primary_key=True)
    purchase_id = db.Column(db.Integer, db.ForeignKey('purchases.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=True)
    product_name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Numeric(10, 3), nullable=False)
    unit = db.Column(db.String(20), default='piece')
    unit_cost = db.Column(db.Numeric(10, 2), nullable=False)
    total_cost = db.Column(db.Numeric(10, 2), nullable=False)

    purchase = db.relationship('Purchase', back_populates='items')

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product_name,
            'quantity': float(self.quantity),
            'unit_cost': float(self.unit_cost),
            'total_cost': float(self.total_cost),
        }


class InventoryLedger(db.Model):
    __tablename__ = 'inventory_ledger'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=True)
    transaction_type = db.Column(db.String(30), nullable=False)
    # opening, purchase, sale, adjustment, transfer_in, transfer_out, damage, return
    reference_type = db.Column(db.String(30))
    reference_id = db.Column(db.Integer)
    quantity_in = db.Column(db.Numeric(10, 3), default=0)
    quantity_out = db.Column(db.Numeric(10, 3), default=0)
    balance = db.Column(db.Numeric(10, 3), nullable=False)
    unit_cost = db.Column(db.Numeric(10, 2), default=0)
    notes = db.Column(db.Text)
    created_by     = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at     = db.Column(db.DateTime, default=db.func.now())
    reset_batch_id = db.Column(db.Integer, db.ForeignKey('data_reset_batches.id'), nullable=True, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'transaction_type': self.transaction_type,
            'quantity_in': float(self.quantity_in or 0),
            'quantity_out': float(self.quantity_out or 0),
            'balance': float(self.balance),
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
        }


class StockBalance(db.Model, TimestampMixin):
    __tablename__ = 'stock_balances'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=True)
    current_stock = db.Column(db.Numeric(10, 3), default=0)
    reserved_stock = db.Column(db.Numeric(10, 3), default=0)
    damaged_stock = db.Column(db.Numeric(10, 3), default=0)
    avg_cost = db.Column(db.Numeric(10, 2), default=0)

    __table_args__ = (
        db.UniqueConstraint('outlet_id', 'product_id', 'variant_id', name='uq_stock_balance'),
    )

    reset_batch_id = db.Column(db.Integer, db.ForeignKey('data_reset_batches.id'), nullable=True, index=True)

    outlet  = db.relationship('Outlet', back_populates='stock_balances')
    product = db.relationship('Product', back_populates='stock_balances')

    def to_dict(self):
        return {
            'id': self.id,
            'outlet_id': self.outlet_id,
            'product_id': self.product_id,
            'variant_id': self.variant_id,
            'current_stock': float(self.current_stock),
            'reserved_stock': float(self.reserved_stock),
            'damaged_stock': float(self.damaged_stock),
            'avg_cost': float(self.avg_cost),
        }


class StockTransfer(db.Model, TimestampMixin):
    __tablename__ = 'stock_transfers'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    transfer_number = db.Column(db.String(30), nullable=False)
    from_outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    to_outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')
    # pending, approved, in_transit, received, cancelled
    requested_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    received_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    notes          = db.Column(db.Text)
    reset_batch_id = db.Column(db.Integer, db.ForeignKey('data_reset_batches.id'), nullable=True, index=True)

    items = db.relationship('StockTransferItem', back_populates='transfer', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'transfer_number': self.transfer_number,
            'from_outlet_id': self.from_outlet_id,
            'to_outlet_id': self.to_outlet_id,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
        }


class StockTransferItem(db.Model, TimestampMixin):
    __tablename__ = 'stock_transfer_items'

    id = db.Column(db.Integer, primary_key=True)
    transfer_id = db.Column(db.Integer, db.ForeignKey('stock_transfers.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=True)
    requested_quantity = db.Column(db.Numeric(10, 3), nullable=False)
    sent_quantity = db.Column(db.Numeric(10, 3), default=0)
    received_quantity = db.Column(db.Numeric(10, 3), default=0)

    transfer = db.relationship('StockTransfer', back_populates='items')


class Expense(db.Model, TimestampMixin):
    __tablename__ = 'expenses'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    expense_date = db.Column(db.Date, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    # rent, electricity, salaries, maintenance, transport, cleaning, other
    description = db.Column(db.String(500), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_mode = db.Column(db.String(20), default='cash')
    reference_number = db.Column(db.String(100))
    receipt_url = db.Column(db.String(500))
    recorded_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    staff_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # for salary expenses
    status         = db.Column(db.String(20), default='approved')  # pending, approved, rejected
    reset_batch_id = db.Column(db.Integer, db.ForeignKey('data_reset_batches.id'), nullable=True, index=True)
    __table_args__ = (
        db.Index('ix_expenses_tenant_date', 'tenant_id', 'expense_date'),
        db.Index('ix_expenses_outlet', 'outlet_id'),
        db.Index('ix_expenses_staff', 'staff_id'),
    )

    def to_dict(self):
        from app.models.user import User
        staff_name = None
        if self.staff_id:
            staff = User.query.get(self.staff_id)
            staff_name = staff.full_name if staff else None
        return {
            'id': self.id,
            'expense_date': self.expense_date.isoformat(),
            'category': self.category,
            'description': self.description,
            'amount': float(self.amount),
            'payment_mode': self.payment_mode,
            'status': self.status,
            'staff_id': self.staff_id,
            'staff_name': staff_name,
            'outlet_id': self.outlet_id,
            'created_at': self.created_at.isoformat(),
        }
