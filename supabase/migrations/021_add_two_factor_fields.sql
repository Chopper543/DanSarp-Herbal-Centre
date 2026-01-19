-- Migration: Add 2FA secret and backup codes fields to users table
-- This enables full TOTP-based two-factor authentication

-- Add 2FA secret field (encrypted/encoded secret for TOTP)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;

-- Add backup codes field (JSON array of backup codes)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[];

-- Add index for faster lookups (though we'll primarily query by id)
CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN users.two_factor_secret IS 'Base32 encoded TOTP secret for 2FA. Should be encrypted in production.';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'Array of backup codes for 2FA recovery. Should be hashed in production.';
