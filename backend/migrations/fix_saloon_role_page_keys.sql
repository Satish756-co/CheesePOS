-- Fix stale role page configs for saloon tenants.
-- Tenants configured as saloon that were previously bar_restaurant have
-- old keys ('billing', 'table_billing', etc.) instead of saloon keys.
-- This replaces those stale configs with the correct saloon defaults per role.

UPDATE tenant_role_configs trc
SET pages = CASE trc.role
  WHEN 'admin' THEN
    '["dashboard","salon_billing","salon_bills_log","salon_services","salon_coupons","salon_summary","expenses","reports","users","roles","outlets"]'::json
  WHEN 'manager' THEN
    '["dashboard","salon_billing","salon_bills_log","salon_services","salon_summary","expenses","reports"]'::json
  WHEN 'cashier' THEN
    '["dashboard","salon_billing","salon_bills_log"]'::json
  WHEN 'inventory_manager' THEN
    '["dashboard","salon_services"]'::json
  WHEN 'accountant' THEN
    '["dashboard","expenses","reports","salon_bills_log"]'::json
  ELSE trc.pages
END
FROM tenants t
WHERE trc.tenant_id = t.id
  AND t.business_type = 'saloon'
  AND trc.role NOT IN ('owner', 'super_admin')
  AND (
    trc.pages::jsonb @> '["billing"]'::jsonb
    OR trc.pages::jsonb @> '["table_billing"]'::jsonb
  );

-- Also add salon_bills_log to any saloon tenant that has salon_billing but not salon_bills_log
-- (handles configs saved after saloon was set up but before this migration)
UPDATE tenant_role_configs trc
SET pages = (trc.pages::jsonb || '["salon_bills_log"]'::jsonb)::json
FROM tenants t
WHERE trc.tenant_id = t.id
  AND t.business_type = 'saloon'
  AND trc.role NOT IN ('owner', 'super_admin')
  AND trc.pages::jsonb @> '["salon_billing"]'::jsonb
  AND NOT (trc.pages::jsonb @> '["salon_bills_log"]'::jsonb);
