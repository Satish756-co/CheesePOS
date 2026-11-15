-- User: flag to force password change on first login
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Tenant: soft-deletion cooling period
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deletion_status VARCHAR(20) DEFAULT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deletion_expires_at TIMESTAMP DEFAULT NULL;
