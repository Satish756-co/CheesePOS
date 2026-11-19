-- Performance indexes for high-frequency query columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_salon_bills_tenant_created ON salon_bills (tenant_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_salon_bills_tenant_status ON salon_bills (tenant_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_salon_bills_staff ON salon_bills (staff_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_salon_bills_outlet ON salon_bills (outlet_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_expenses_tenant_date ON expenses (tenant_id, expense_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_expenses_outlet ON expenses (outlet_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_expenses_staff ON expenses (staff_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_tenant ON users (tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_salon_services_tenant ON salon_services (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_salon_services_category ON salon_services (category_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_ssop_outlet ON salon_service_outlet_prices (outlet_id);
