-- Approval requests for salon bill cancellations
CREATE TABLE IF NOT EXISTS salon_bill_cancel_requests (
    id           SERIAL PRIMARY KEY,
    tenant_id    INTEGER NOT NULL REFERENCES tenants(id),
    bill_id      INTEGER NOT NULL REFERENCES salon_bills(id) ON DELETE CASCADE,
    requested_by INTEGER NOT NULL REFERENCES users(id),
    reason       VARCHAR(500),
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by  INTEGER REFERENCES users(id),
    review_note  VARCHAR(500),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Only one pending request allowed per bill at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_cancel_request_pending
    ON salon_bill_cancel_requests (bill_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ix_cancel_requests_tenant_status
    ON salon_bill_cancel_requests (tenant_id, status);
