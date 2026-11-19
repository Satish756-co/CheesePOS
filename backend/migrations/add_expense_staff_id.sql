-- Add staff_id to expenses for salary tracking
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
