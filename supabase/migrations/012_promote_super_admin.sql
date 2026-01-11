-- Migration: Promote specific user to super_admin and enforce single super_admin
-- This migration promotes user with id 397c1e07-ea09-4f9a-9797-dbdbfc0b05fe to super_admin
-- and ensures only one super_admin can exist in the system

-- Step 1: Demote all existing super_admin users to admin
-- (This ensures we start with a clean state)
UPDATE users
SET role = 'admin'::user_role,
    updated_at = NOW()
WHERE role = 'super_admin'::user_role
  AND id != '397c1e07-ea09-4f9a-9797-dbdbfc0b05fe'::uuid;

-- Step 2: Promote the specified user to super_admin
UPDATE users
SET role = 'super_admin'::user_role,
    updated_at = NOW()
WHERE id = '397c1e07-ea09-4f9a-9797-dbdbfc0b05fe'::uuid;

-- Step 3: Create unique partial index to enforce single super_admin
-- This prevents multiple super_admin users from existing simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS unique_super_admin 
ON users (role) 
WHERE role = 'super_admin';

-- Step 4: Verification (optional logging)
DO $$
DECLARE
  super_admin_count INTEGER;
  promoted_user RECORD;
BEGIN
  -- Count super_admins
  SELECT COUNT(*) INTO super_admin_count
  FROM users
  WHERE role = 'super_admin';
  
  -- Get promoted user info
  SELECT id, email, role INTO promoted_user
  FROM users
  WHERE id = '397c1e07-ea09-4f9a-9797-dbdbfc0b05fe'::uuid;
  
  IF super_admin_count != 1 THEN
    RAISE WARNING 'Expected exactly 1 super_admin, found %', super_admin_count;
  ELSIF promoted_user.role != 'super_admin' THEN
    RAISE WARNING 'Failed to promote user to super_admin. Current role: %', promoted_user.role;
  ELSE
    RAISE NOTICE 'Successfully promoted user % (id: %) to super_admin. Total super_admins: %', 
      promoted_user.email, promoted_user.id, super_admin_count;
  END IF;
END $$;
