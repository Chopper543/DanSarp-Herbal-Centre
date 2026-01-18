-- Migration: Update user sync trigger to capture phone number
-- This migration updates sync_user_from_auth() to capture phone number
-- from auth.users.phone or user_metadata

-- Recreate the function to include phone number
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
  INSERT INTO users (id, email, full_name, phone, email_verified, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    NEW.email_confirmed_at IS NOT NULL,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = NEW.email,
    full_name = COALESCE(
      EXCLUDED.full_name,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
    ),
    phone = COALESCE(EXCLUDED.phone, NEW.phone, NEW.raw_user_meta_data->>'phone'),
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
