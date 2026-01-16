-- Migration: Add RLS bypass policies for super_admin
-- This migration adds comprehensive policies that allow super_admin to bypass RLS
-- and have full access to all tables in the database

-- Super admins can manage profiles (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage profiles" ON profiles;
CREATE POLICY "Super admins can manage profiles"
  ON profiles FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage users (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage users" ON users;
CREATE POLICY "Super admins can manage users"
  ON users FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage branches (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage branches" ON branches;
CREATE POLICY "Super admins can manage branches"
  ON branches FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage treatments (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage treatments" ON treatments;
CREATE POLICY "Super admins can manage treatments"
  ON treatments FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage appointments (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage appointments" ON appointments;
CREATE POLICY "Super admins can manage appointments"
  ON appointments FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage reviews (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage reviews" ON reviews;
CREATE POLICY "Super admins can manage reviews"
  ON reviews FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage gallery_items (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage gallery_items" ON gallery_items;
CREATE POLICY "Super admins can manage gallery_items"
  ON gallery_items FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage testimonials (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage testimonials" ON testimonials;
CREATE POLICY "Super admins can manage testimonials"
  ON testimonials FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage payments (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage payments" ON payments;
CREATE POLICY "Super admins can manage payments"
  ON payments FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage payment_ledger (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage payment_ledger" ON payment_ledger;
CREATE POLICY "Super admins can manage payment_ledger"
  ON payment_ledger FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage organization_profile (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage organization_profile" ON organization_profile;
CREATE POLICY "Super admins can manage organization_profile"
  ON organization_profile FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage blog_posts (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage blog_posts" ON blog_posts;
CREATE POLICY "Super admins can manage blog_posts"
  ON blog_posts FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage newsletter_subscribers (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage newsletter_subscribers" ON newsletter_subscribers;
CREATE POLICY "Super admins can manage newsletter_subscribers"
  ON newsletter_subscribers FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage admin_invites (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage admin_invites" ON admin_invites;
CREATE POLICY "Super admins can manage admin_invites"
  ON admin_invites FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage audit_logs (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Super admins can manage audit_logs" ON audit_logs;
CREATE POLICY "Super admins can manage audit_logs"
  ON audit_logs FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can manage messages (SELECT, INSERT, UPDATE, DELETE)
-- Check if messages table exists first
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'messages'
  ) THEN
    DROP POLICY IF EXISTS "Super admins can manage messages" ON messages;
    EXECUTE 'CREATE POLICY "Super admins can manage messages"
      ON messages FOR ALL
      USING (is_super_admin())
      WITH CHECK (is_super_admin())';
  END IF;
END $$;
