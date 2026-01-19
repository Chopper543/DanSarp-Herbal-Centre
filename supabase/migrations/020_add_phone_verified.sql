-- Migration: Add phone_verified field to users table
-- This tracks whether a user's phone number has been verified via OTP

-- Add phone_verified column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Update existing users: set phone_verified based on auth.users.phone_confirmed_at
UPDATE users u
SET phone_verified = (
  SELECT phone_confirmed_at IS NOT NULL 
  FROM auth.users au 
  WHERE au.id = u.id
)
WHERE EXISTS (
  SELECT 1 FROM auth.users au WHERE au.id = u.id
);

-- Update the sync_user_from_auth() function to sync phone_verified
CREATE OR REPLACE FUNCTION sync_user_from_auth()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert or update user record
  INSERT INTO users (id, email, full_name, phone, email_verified, phone_verified, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    NEW.email_confirmed_at IS NOT NULL,
    NEW.phone_confirmed_at IS NOT NULL,
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
    phone_verified = NEW.phone_confirmed_at IS NOT NULL,
    updated_at = NOW();

  -- Create profile if it doesn't exist
  INSERT INTO profiles (id, created_at, updated_at)
  VALUES (NEW.id, COALESCE(NEW.created_at, NOW()), NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth.users insert
    RAISE WARNING 'Error in sync_user_from_auth for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure the function is owned by postgres (superuser)
ALTER FUNCTION sync_user_from_auth() OWNER TO postgres;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_user_from_auth() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_user_from_auth() TO anon;
GRANT EXECUTE ON FUNCTION sync_user_from_auth() TO service_role;
