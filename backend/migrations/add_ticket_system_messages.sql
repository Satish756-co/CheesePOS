-- Allow system messages (no sender) and track activity events
ALTER TABLE ticket_messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE ticket_messages ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Store customer feedback text (column already has customer_rating; just add feedback if missing)
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS customer_feedback TEXT;
