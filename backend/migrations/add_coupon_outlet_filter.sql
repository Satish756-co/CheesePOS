-- Add outlet_id to salon_coupons for per-outlet coupon scoping
-- NULL = valid at all outlets; set to an outlet_id to restrict to that outlet only

ALTER TABLE salon_coupons
  ADD COLUMN IF NOT EXISTS outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL;
