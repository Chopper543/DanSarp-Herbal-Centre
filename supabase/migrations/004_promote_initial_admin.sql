-- Migration: Promote initial admin user to super_admin
-- This migration promotes the user antwidaniel543@gmail.com to super_admin role
-- Run this migration once during initial setup via Supabase Dashboard SQL Editor or CLI

-- Find user by email and promote to super_admin
-- This handles both cases: user exists in users table or needs to be created
WITH user_lookup AS (
  SELECT 
    id, 
    email, 
    email_confirmed_at,
    created_at as auth_created_at
  FROM auth.users
  WHERE email = 'antwidaniel543@gmail.com'
)
INSERT INTO users (id, email, role, email_verified, created_at, updated_at)
SELECT 
  id,
  email,
  'super_admin'::user_role,
  email_confirmed_at IS NOT NULL,
  COALESCE(auth_created_at, NOW()),
  NOW()
FROM user_lookup
ON CONFLICT (id) 
DO UPDATE SET
  role = 'super_admin'::user_role,
  email_verified = (SELECT email_confirmed_at IS NOT NULL FROM auth.users WHERE id = EXCLUDED.id),
  updated_at = NOW();

-- Verify the update (optional - can be removed in production)
DO $$
DECLARE
  promoted_user RECORD;
BEGIN
  SELECT id, email, role, email_verified 
  INTO promoted_user
  FROM users 
  WHERE email = 'antwidaniel543@gmail.com';
  
  IF promoted_user.id IS NULL THEN
    RAISE WARNING 'User with email antwidaniel543@gmail.com not found in auth.users. Please ensure the user exists and try again.';
  ELSIF promoted_user.role != 'super_admin' THEN
    RAISE WARNING 'Failed to promote user to super_admin. Current role: %', promoted_user.role;
  ELSE
    RAISE NOTICE 'Successfully promoted user % to super_admin role', promoted_user.email;
  END IF;
END $$;
