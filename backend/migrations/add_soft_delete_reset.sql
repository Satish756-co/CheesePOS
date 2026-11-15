-- Migration: Add soft-delete reset (data_reset_batches + reset_batch_id columns)
-- Run on PostgreSQL:  psql -U barpro_user -d barpro_db -f migrations/add_soft_delete_reset.sql

-- 1. Create the reset-batch tracking table
CREATE TABLE IF NOT EXISTS data_reset_batches (
    id          SERIAL PRIMARY KEY,
    tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    reset_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    options     JSON NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW() NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    status      VARCHAR(20) DEFAULT 'active' NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_data_reset_batches_tenant_id ON data_reset_batches(tenant_id);
CREATE INDEX IF NOT EXISTS ix_data_reset_batches_status    ON data_reset_batches(status);

-- 2. Add reset_batch_id to all affected tables
ALTER TABLE orders           ADD COLUMN IF NOT EXISTS reset_batch_id INTEGER REFERENCES data_reset_batches(id);
ALTER TABLE kots             ADD COLUMN IF NOT EXISTS reset_batch_id INTEGER REFERENCES data_reset_batches(id);
ALTER TABLE invoices         ADD COLUMN IF NOT EXISTS reset_batch_id INTEGER REFERENCES data_reset_batches(id);
ALTER TABLE purchases        ADD COLUMN IF NOT EXISTS reset_batch_id INTEGER REFERENCES data_reset_batches(id);
ALTER TABLE inventory_ledger ADD COLUMN IF NOT EXISTS reset_batch_id INTEGER REFERENCES data_reset_batches(id);
ALTER TABLE stock_balances   ADD COLUMN IF NOT EXISTS reset_batch_id INTEGER REFERENCES data_reset_batches(id);
ALTER TABLE stock_transfers  ADD COLUMN IF NOT EXISTS reset_batch_id INTEGER REFERENCES data_reset_batches(id);
ALTER TABLE expenses         ADD COLUMN IF NOT EXISTS reset_batch_id INTEGER REFERENCES data_reset_batches(id);
ALTER TABLE users            ADD COLUMN IF NOT EXISTS reset_batch_id INTEGER REFERENCES data_reset_batches(id);

-- 3. Create indexes for fast filtering
CREATE INDEX IF NOT EXISTS ix_orders_reset_batch_id           ON orders(reset_batch_id);
CREATE INDEX IF NOT EXISTS ix_kots_reset_batch_id             ON kots(reset_batch_id);
CREATE INDEX IF NOT EXISTS ix_invoices_reset_batch_id         ON invoices(reset_batch_id);
CREATE INDEX IF NOT EXISTS ix_purchases_reset_batch_id        ON purchases(reset_batch_id);
CREATE INDEX IF NOT EXISTS ix_inventory_ledger_reset_batch_id ON inventory_ledger(reset_batch_id);
CREATE INDEX IF NOT EXISTS ix_stock_balances_reset_batch_id   ON stock_balances(reset_batch_id);
CREATE INDEX IF NOT EXISTS ix_stock_transfers_reset_batch_id  ON stock_transfers(reset_batch_id);
CREATE INDEX IF NOT EXISTS ix_expenses_reset_batch_id         ON expenses(reset_batch_id);
CREATE INDEX IF NOT EXISTS ix_users_reset_batch_id            ON users(reset_batch_id);
