-- Support: read-tracking timestamps + last-message timestamps for unread detection
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS customer_last_read_at TIMESTAMP DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS staff_last_read_at TIMESTAMP DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_staff_message_at TIMESTAMP DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMP DEFAULT NULL;
