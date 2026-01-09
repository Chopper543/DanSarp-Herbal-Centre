-- Migration: Fix user creation by adding INSERT policy for users table
-- This allows the sync_user_from_auth trigger to insert user records

-- The trigger function uses SECURITY DEFINER which should bypass RLS,
-- but we'll add explicit policies to ensure user creation works.
-- These policies allow inserts when the user ID matches the authenticated user
-- (which is what happens during signup via the trigger)

-- Policy to allow users to be created via the trigger
CREATE POLICY "Allow user creation via trigger"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy to allow profiles to be created via the trigger  
CREATE POLICY "Allow profile creation via trigger"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Ensure the trigger function has proper ownership and permissions
-- The function should already be SECURITY DEFINER, but we'll verify
ALTER FUNCTION sync_user_from_auth() OWNER TO postgres;
