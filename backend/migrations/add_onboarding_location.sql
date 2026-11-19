-- Add location fields to onboarding_requests
ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
