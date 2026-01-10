-- Migration: Fix infinite recursion in RLS policies
-- The issue is that policies on the users table are querying the users table itself,
-- causing infinite recursion. We'll create a SECURITY DEFINER function to check roles
-- without triggering RLS.

-- Create a helper function to check if current user has admin role
-- This function bypasses RLS using SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE id = auth.uid();
  
  RETURN user_role IN ('super_admin', 'admin', 'content_manager', 'appointment_manager', 'finance_manager');
END;
$$;

-- Create a helper function to check if current user is super_admin or admin
CREATE OR REPLACE FUNCTION is_super_admin_or_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE id = auth.uid();
  
  RETURN user_role IN ('super_admin', 'admin');
END;
$$;

-- Create a helper function to check if current user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE id = auth.uid();
  
  RETURN user_role = 'super_admin';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_user() TO anon;
GRANT EXECUTE ON FUNCTION is_super_admin_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin_or_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO anon;

-- Drop and recreate the "Admins can view all users" policy to use the helper function
DROP POLICY IF EXISTS "Admins can view all users" ON users;

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (is_super_admin_or_admin());

-- Update other policies that check users table to use helper functions
-- Note: We'll update the most critical ones. Others can be updated as needed.

-- Branches: Admins can manage
DROP POLICY IF EXISTS "Admins can manage branches" ON branches;
CREATE POLICY "Admins can manage branches"
  ON branches FOR ALL
  USING (is_super_admin_or_admin());

-- Treatments: Admins can manage
DROP POLICY IF EXISTS "Admins can manage treatments" ON treatments;
CREATE POLICY "Admins can manage treatments"
  ON treatments FOR ALL
  USING (is_admin_user());

-- Appointments: Admins can view all
DROP POLICY IF EXISTS "Admins can view all appointments" ON appointments;
CREATE POLICY "Admins can view all appointments"
  ON appointments FOR SELECT
  USING (is_admin_user());

-- Appointments: Admins can update all
DROP POLICY IF EXISTS "Admins can update all appointments" ON appointments;
CREATE POLICY "Admins can update all appointments"
  ON appointments FOR UPDATE
  USING (is_admin_user());

-- Reviews: Admins can view all
DROP POLICY IF EXISTS "Admins can view all reviews" ON reviews;
CREATE POLICY "Admins can view all reviews"
  ON reviews FOR SELECT
  USING (is_admin_user());

-- Reviews: Admins can update
DROP POLICY IF EXISTS "Admins can update reviews" ON reviews;
CREATE POLICY "Admins can update reviews"
  ON reviews FOR UPDATE
  USING (is_admin_user());

-- Gallery items: Admins can manage
DROP POLICY IF EXISTS "Admins can manage gallery items" ON gallery_items;
CREATE POLICY "Admins can manage gallery items"
  ON gallery_items FOR ALL
  USING (is_admin_user());

-- Testimonials: Admins can view all
DROP POLICY IF EXISTS "Admins can view all testimonials" ON testimonials;
CREATE POLICY "Admins can view all testimonials"
  ON testimonials FOR SELECT
  USING (is_admin_user());

-- Testimonials: Admins can manage
DROP POLICY IF EXISTS "Admins can manage testimonials" ON testimonials;
CREATE POLICY "Admins can manage testimonials"
  ON testimonials FOR ALL
  USING (is_admin_user());

-- Payments: Admins can view all
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  USING (is_admin_user());

-- Payments: Admins can update
DROP POLICY IF EXISTS "Admins can update payments" ON payments;
CREATE POLICY "Admins can update payments"
  ON payments FOR UPDATE
  USING (is_admin_user());

-- Payment ledger: Admins can view
DROP POLICY IF EXISTS "Admins can view payment ledger" ON payment_ledger;
CREATE POLICY "Admins can view payment ledger"
  ON payment_ledger FOR SELECT
  USING (is_admin_user());

-- Organization profile: Admins can manage
DROP POLICY IF EXISTS "Admins can manage organization profile" ON organization_profile;
CREATE POLICY "Admins can manage organization profile"
  ON organization_profile FOR ALL
  USING (is_admin_user());

-- Blog posts: Admins can manage all
DROP POLICY IF EXISTS "Admins can manage all blog posts" ON blog_posts;
CREATE POLICY "Admins can manage all blog posts"
  ON blog_posts FOR ALL
  USING (is_admin_user());

-- Newsletter subscribers: Admins can view
DROP POLICY IF EXISTS "Admins can view subscribers" ON newsletter_subscribers;
CREATE POLICY "Admins can view subscribers"
  ON newsletter_subscribers FOR SELECT
  USING (is_admin_user());

-- Admin invites: Admins can view
DROP POLICY IF EXISTS "Admins can view invites" ON admin_invites;
CREATE POLICY "Admins can view invites"
  ON admin_invites FOR SELECT
  USING (is_super_admin_or_admin());

-- Admin invites: Super admins can create
DROP POLICY IF EXISTS "Super admins can create invites" ON admin_invites;
CREATE POLICY "Super admins can create invites"
  ON admin_invites FOR INSERT
  WITH CHECK (is_super_admin());

-- Audit logs: Admins can view
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (is_super_admin_or_admin());
