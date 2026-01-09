-- Migration: Fix user creation trigger to explicitly bypass RLS
-- This updates the sync_user_from_auth() function to ensure it can insert users
-- even when RLS is enabled

-- Recreate the function with explicit SECURITY DEFINER and proper error handling
CREATE OR REPLACE FUNCTION sync_user_from_auth()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- SECURITY DEFINER functions run with the privileges of the function owner (postgres)
  -- This should bypass RLS, but we'll ensure proper permissions are granted
  
  -- Insert or update user record
  INSERT INTO users (id, email, full_name, email_verified, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email_confirmed_at IS NOT NULL,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = NEW.email,
    email_verified = NEW.email_confirmed_at IS NOT NULL,
    updated_at = NOW();

  -- Create profile if it doesn't exist
  INSERT INTO profiles (id, created_at, updated_at)
  VALUES (NEW.id, COALESCE(NEW.created_at, NOW()), NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth.users insert
    -- This prevents auth signup from failing if there's an issue with the sync
    RAISE WARNING 'Error in sync_user_from_auth for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure the function is owned by postgres (superuser)
ALTER FUNCTION sync_user_from_auth() OWNER TO postgres;

-- Grant execute permission to authenticated users (needed for trigger)
GRANT EXECUTE ON FUNCTION sync_user_from_auth() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_user_from_auth() TO anon;
GRANT EXECUTE ON FUNCTION sync_user_from_auth() TO service_role;

-- Explicitly grant INSERT permissions to the function owner on the tables
-- This ensures the SECURITY DEFINER function can insert
GRANT INSERT ON users TO postgres;
GRANT INSERT ON profiles TO postgres;
GRANT UPDATE ON users TO postgres;
GRANT UPDATE ON profiles TO postgres;
