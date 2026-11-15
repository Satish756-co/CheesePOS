-- Run this to create the role permissions table
-- Then restart the Flask backend

CREATE TABLE IF NOT EXISTS tenant_role_configs (
    id          SERIAL PRIMARY KEY,
    tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role        VARCHAR(30) NOT NULL,
    pages       JSON DEFAULT '[]'::json,
    actions     JSON DEFAULT '[]'::json,
    approvals   JSON DEFAULT '[]'::json,
    data_scope  VARCHAR(20) DEFAULT 'all',
    updated_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMP DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_tenant_role_config UNIQUE (tenant_id, role)
);

-- OR using Flask-Migrate:
--   cd backend
--   flask db migrate -m "add_tenant_role_configs"
--   flask db upgrade
