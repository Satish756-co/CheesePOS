-- Add manual OOS override and billing visibility flags to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS force_out_of_stock BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
