from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db
from app.models.base import TimestampMixin


ROLES = {
    'super_admin': 'Super Admin',
    'owner': 'Business Owner',
    'admin': 'Admin',
    'manager': 'Manager',
    'cashier': 'Cashier',
    'waiter': 'Waiter',
    'kitchen': 'Kitchen Staff',
    'inventory_manager': 'Inventory Manager',
    'accountant': 'Accountant',
}

ROLE_PERMISSIONS = {
    'super_admin': ['*'],
    'owner': ['business.*', 'outlet.*', 'billing.*', 'inventory.*', 'reports.*', 'users.*'],
    'admin': ['outlet.*', 'billing.*', 'inventory.*', 'reports.view', 'users.manage'],
    'manager': ['billing.*', 'inventory.*', 'reports.view', 'tables.*', 'orders.*', 'expenses.*'],
    'cashier': ['billing.create', 'billing.view', 'billing.cancel_own', 'payments.*'],
    'waiter': ['orders.create', 'orders.view', 'tables.view', 'tables.update', 'billing.create', 'billing.view'],
    'kitchen': ['kot.view', 'kot.update'],
    'inventory_manager': ['inventory.*', 'purchases.*', 'suppliers.*'],
    'accountant': ['reports.*', 'expenses.view', 'billing.view'],
}

# Default page/action/approval configs per role — used when no tenant override exists
ROLE_DEFAULT_CONFIGS = {
    'owner': {
        'pages': ['*'],
        'actions': ['*'],
        'approvals': [],
        'data_scope': 'all',
    },
    'admin': {
        'pages': ['dashboard', 'billing', 'table_billing', 'orders', 'tables', 'sales_log',
                  'kot', 'products', 'inventory', 'purchases', 'expenses', 'reports', 'users', 'roles', 'outlets',
                  'salon_billing', 'salon_bills_log', 'salon_services', 'salon_coupons', 'salon_summary'],
        'actions': ['billing.view', 'billing.create', 'billing.cancel', 'billing.cancel_own', 'billing.discount',
                    'orders.view', 'orders.create', 'orders.edit', 'orders.cancel',
                    'tables.view', 'tables.update',
                    'purchases.view', 'purchases.create', 'purchases.approve', 'purchases.receive',
                    'expenses.view', 'expenses.create', 'expenses.approve',
                    'inventory.view', 'inventory.adjust',
                    'reports.view', 'reports.export',
                    'users.view', 'users.create', 'users.edit',
                    'kot.view', 'kot.update'],
        'approvals': [],
        'data_scope': 'all',
    },
    'manager': {
        'pages': ['dashboard', 'billing', 'table_billing', 'orders', 'tables', 'sales_log',
                  'kot', 'inventory', 'expenses', 'reports',
                  'salon_billing', 'salon_bills_log', 'salon_services', 'salon_summary'],
        'actions': ['billing.view', 'billing.create', 'billing.cancel', 'billing.cancel_own', 'billing.discount',
                    'orders.view', 'orders.create', 'orders.edit', 'orders.cancel',
                    'tables.view', 'tables.update',
                    'expenses.view', 'expenses.create', 'expenses.approve',
                    'inventory.view', 'inventory.adjust',
                    'reports.view', 'kot.view', 'kot.update'],
        'approvals': [],
        'data_scope': 'all',
    },
    'cashier': {
        'pages': ['dashboard', 'billing', 'table_billing', 'sales_log', 'salon_billing', 'salon_bills_log'],
        'actions': ['billing.view', 'billing.create', 'billing.cancel_own'],
        'approvals': ['billing.cancel'],
        'data_scope': 'all',
    },
    'waiter': {
        'pages': ['dashboard', 'table_billing', 'orders', 'tables', 'salon_billing'],
        'actions': ['orders.view', 'orders.create', 'orders.edit',
                    'tables.view', 'tables.update', 'billing.view', 'billing.create'],
        'approvals': ['billing.cancel', 'orders.cancel'],
        'data_scope': 'own',
    },
    'kitchen': {
        'pages': ['dashboard', 'kot'],
        'actions': ['kot.view', 'kot.update'],
        'approvals': [],
        'data_scope': 'all',
    },
    'inventory_manager': {
        'pages': ['dashboard', 'products', 'inventory', 'purchases', 'salon_services'],
        'actions': ['inventory.view', 'inventory.adjust',
                    'purchases.view', 'purchases.create', 'purchases.receive'],
        'approvals': ['purchases.approve'],
        'data_scope': 'outlet',
    },
    'accountant': {
        'pages': ['dashboard', 'expenses', 'reports', 'sales_log', 'salon_bills_log'],
        'actions': ['reports.view', 'reports.export', 'expenses.view', 'billing.view'],
        'approvals': [],
        'data_scope': 'all',
    },
}


def get_role_config(tenant_id, role, feature_overrides=None):
    """Return effective permission config for a role: DB override if set, else defaults.
    feature_overrides: dict of {page: False} set by super admin to disable features tenant-wide.
    """
    if role in ('owner', 'super_admin'):
        config = {'pages': ['*'], 'actions': ['*'], 'approvals': [], 'data_scope': 'all'}
    else:
        db_config = TenantRoleConfig.query.filter_by(tenant_id=tenant_id, role=role).first()
        if db_config:
            config = {'pages': db_config.pages, 'actions': db_config.actions,
                      'approvals': db_config.approvals, 'data_scope': db_config.data_scope}
        else:
            config = ROLE_DEFAULT_CONFIGS.get(
                role, {'pages': [], 'actions': [], 'approvals': [], 'data_scope': 'all'}
            )

    # Attach disabled_features so the frontend can block them even for owner/admin
    disabled = [k for k, v in (feature_overrides or {}).items() if v is False]
    config['disabled_features'] = disabled
    return config


class TenantRoleConfig(db.Model, TimestampMixin):
    """Per-tenant overrides for role permissions."""
    __tablename__ = 'tenant_role_configs'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    role = db.Column(db.String(30), nullable=False)
    pages = db.Column(db.JSON, default=list)      # sidebar tabs visible
    actions = db.Column(db.JSON, default=list)    # fine-grained actions allowed
    approvals = db.Column(db.JSON, default=list)  # actions that need manager approval
    data_scope = db.Column(db.String(20), default='all')  # own | outlet | all
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    __table_args__ = (db.UniqueConstraint('tenant_id', 'role', name='uq_tenant_role_config'),)

    def to_dict(self):
        return {
            'role': self.role,
            'pages': self.pages,
            'actions': self.actions,
            'approvals': self.approvals,
            'data_scope': self.data_scope,
        }




class User(db.Model, TimestampMixin):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=True)
    employee_code = db.Column(db.String(20))
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    phone = db.Column(db.String(20))
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(30), nullable=False, default='cashier')
    is_active = db.Column(db.Boolean, default=True)
    is_super_admin = db.Column(db.Boolean, default=False)
    profile_photo = db.Column(db.String(500))
    last_login_at = db.Column(db.DateTime)
    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime)
    password_reset_token = db.Column(db.String(100))
    password_reset_expires = db.Column(db.DateTime)
    two_factor_enabled = db.Column(db.Boolean, default=False)
    two_factor_secret = db.Column(db.String(100))
    token_version  = db.Column(db.Integer, nullable=False, default=0)
    must_change_password = db.Column(db.Boolean, nullable=False, default=False)
    terms_accepted_at    = db.Column(db.DateTime, nullable=True)
    reset_batch_id = db.Column(db.Integer, db.ForeignKey('data_reset_batches.id'), nullable=True, index=True)
    __table_args__ = (
        db.Index('ix_users_tenant', 'tenant_id'),
    )

    tenant = db.relationship('Tenant', back_populates='users')
    outlet_assignments = db.relationship('UserOutlet', back_populates='user', lazy='dynamic')

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def has_permission(self, permission):
        perms = ROLE_PERMISSIONS.get(self.role, [])
        if '*' in perms or self.is_super_admin:
            return True
        if permission in perms:
            return True
        category = permission.split('.')[0]
        if f'{category}.*' in perms:
            return True
        return False

    def get_accessible_outlets(self):
        if self.role in ('super_admin', 'owner', 'admin'):
            from app.models.outlet import Outlet
            return Outlet.query.filter_by(tenant_id=self.tenant_id, is_active=True).all()
        return [ua.outlet for ua in self.outlet_assignments.filter_by(is_active=True).all()]

    def to_dict(self, include_sensitive=False):
        data = {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'employee_code': self.employee_code,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': self.full_name,
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
            'role_label': ROLES.get(self.role, self.role),
            'is_active': self.is_active,
            'is_super_admin': self.is_super_admin,
            'profile_photo': self.profile_photo,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'must_change_password': self.must_change_password,
            'terms_accepted_at': self.terms_accepted_at.isoformat() if self.terms_accepted_at else None,
            'created_at': self.created_at.isoformat(),
            'outlet_ids': [ua.outlet_id for ua in self.outlet_assignments.filter_by(is_active=True).all()],
        }
        return data


class UserOutlet(db.Model, TimestampMixin):
    __tablename__ = 'user_outlets'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    user = db.relationship('User', back_populates='outlet_assignments')
    outlet = db.relationship('Outlet', back_populates='user_assignments')


class UserTenantAccess(db.Model):
    """Links a user (owner) to multiple tenants for multi-business support."""
    __tablename__ = 'user_tenant_access'

    id        = db.Column(db.Integer, primary_key=True)
    user_id   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    role      = db.Column(db.String(30), default='owner')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'tenant_id', name='uq_user_tenant'),)

    user   = db.relationship('User', backref=db.backref('tenant_accesses', lazy='dynamic'))
    tenant = db.relationship('Tenant', backref=db.backref('user_accesses', lazy='dynamic'))


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=True)
    outlet_id = db.Column(db.Integer, db.ForeignKey('outlets.id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    resource_type = db.Column(db.String(50))
    resource_id = db.Column(db.Integer)
    old_values = db.Column(db.JSON)
    new_values = db.Column(db.JSON)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat(),
        }
