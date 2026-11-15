-- Add unique constraint on (tenant_id, order_number) to prevent duplicate order numbers
-- under concurrent creates for the same tenant.
-- Safe to run on existing data only if no duplicates exist.
-- Check first: SELECT tenant_id, order_number, COUNT(*) FROM orders GROUP BY tenant_id, order_number HAVING COUNT(*) > 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_orders_tenant_number'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT uq_orders_tenant_number UNIQUE (tenant_id, order_number);
    END IF;
END;
$$;
