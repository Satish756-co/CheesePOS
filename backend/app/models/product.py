from app.extensions import db
from app.models.base import TimestampMixin


class Category(db.Model, TimestampMixin):
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    category_type = db.Column(db.String(20), default='both')  # bar, food, both
    icon = db.Column(db.String(50))
    color = db.Column(db.String(20))
    display_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)

    products = db.relationship('Product', back_populates='category', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category_type': self.category_type,
            'icon': self.icon,
            'color': self.color,
            'display_order': self.display_order,
            'is_active': self.is_active,
        }


class Product(db.Model, TimestampMixin):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=True)  # null = all outlets
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    brand = db.Column(db.String(100))
    sku = db.Column(db.String(50))
    product_type = db.Column(db.String(20), default='food')  # liquor, food, beverage
    description = db.Column(db.Text)
    image_url = db.Column(db.String(500))
    unit = db.Column(db.String(20), default='piece')  # piece, ml, kg, plate
    purchase_price = db.Column(db.Numeric(10, 2), default=0)
    selling_price = db.Column(db.Numeric(10, 2), nullable=False)
    mrp = db.Column(db.Numeric(10, 2))
    tax_category = db.Column(db.String(50))  # gst_5, gst_12, gst_18, gst_28, liquor_ap, exempt
    tax_inclusive = db.Column(db.Boolean, default=True)
    service_charge_applicable = db.Column(db.Boolean, default=False)
    is_liquor = db.Column(db.Boolean, default=False)
    requires_kot = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)
    force_out_of_stock = db.Column(db.Boolean, default=False)  # manual OOS override regardless of stock
    is_hidden = db.Column(db.Boolean, default=False)           # hide from billing screens
    low_stock_threshold = db.Column(db.Numeric(10, 3), default=10)
    barcode = db.Column(db.String(50))
    hsn_code = db.Column(db.String(20))

    outlet = db.relationship('Outlet', back_populates='products')
    category = db.relationship('Category', back_populates='products')
    variants = db.relationship('ProductVariant', back_populates='product', lazy='dynamic', cascade='all, delete-orphan')
    stock_balances = db.relationship('StockBalance', back_populates='product', lazy='dynamic')

    def to_dict(self, include_variants=False):
        data = {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None,
            'name': self.name,
            'brand': self.brand,
            'sku': self.sku,
            'product_type': self.product_type,
            'unit': self.unit,
            'purchase_price': float(self.purchase_price) if self.purchase_price else 0,
            'selling_price': float(self.selling_price),
            'mrp': float(self.mrp) if self.mrp else None,
            'tax_category': self.tax_category,
            'tax_inclusive': self.tax_inclusive,
            'is_liquor': self.is_liquor,
            'requires_kot': self.requires_kot,
            'is_active': self.is_active,
            'force_out_of_stock': self.force_out_of_stock,
            'is_hidden': self.is_hidden,
            'image_url': self.image_url,
            'barcode': self.barcode,
        }
        if include_variants:
            data['variants'] = [v.to_dict() for v in self.variants.filter(
                ProductVariant.is_active.is_not(False)
            ).all()]
        return data


class ProductVariant(db.Model, TimestampMixin):
    __tablename__ = 'product_variants'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    variant_name = db.Column(db.String(50), nullable=False)  # 90ml, 180ml, 375ml, 750ml, pint, can
    size_ml = db.Column(db.Numeric(10, 2))
    purchase_price = db.Column(db.Numeric(10, 2), default=0)
    selling_price = db.Column(db.Numeric(10, 2), nullable=False)
    mrp = db.Column(db.Numeric(10, 2))
    sku = db.Column(db.String(50))
    barcode = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)

    product = db.relationship('Product', back_populates='variants')

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'variant_name': self.variant_name,
            'size_ml': float(self.size_ml) if self.size_ml else None,
            'selling_price': float(self.selling_price),
            'mrp': float(self.mrp) if self.mrp else None,
            'sku': self.sku,
            'is_active': self.is_active,
        }


class TaxConfiguration(db.Model, TimestampMixin):
    __tablename__ = 'tax_configurations'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=True)
    tax_name = db.Column(db.String(100), nullable=False)
    tax_code = db.Column(db.String(50), nullable=False)
    rate = db.Column(db.Numeric(5, 2), nullable=False)
    applicable_to = db.Column(db.String(50))  # liquor, food, all
    state = db.Column(db.String(50))
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'tax_name': self.tax_name,
            'tax_code': self.tax_code,
            'rate': float(self.rate),
            'applicable_to': self.applicable_to,
            'state': self.state,
            'is_active': self.is_active,
        }
