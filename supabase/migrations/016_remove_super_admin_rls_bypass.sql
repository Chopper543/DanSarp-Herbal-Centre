-- Migration: Remove super admin RLS bypass policies
-- This migration removes all the bypass policies created in migration 014
-- Super admins will now use the same RLS policies as regular admins
-- which already include 'super_admin' in their role checks

-- Drop all super admin bypass policies
DROP POLICY IF EXISTS "Super admins can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can manage users" ON users;
DROP POLICY IF EXISTS "Super admins can manage branches" ON branches;
DROP POLICY IF EXISTS "Super admins can manage treatments" ON treatments;
DROP POLICY IF EXISTS "Super admins can manage appointments" ON appointments;
DROP POLICY IF EXISTS "Super admins can manage reviews" ON reviews;
DROP POLICY IF EXISTS "Super admins can manage gallery_items" ON gallery_items;
DROP POLICY IF EXISTS "Super admins can manage testimonials" ON testimonials;
DROP POLICY IF EXISTS "Super admins can manage payments" ON payments;
DROP POLICY IF EXISTS "Super admins can manage payment_ledger" ON payment_ledger;
DROP POLICY IF EXISTS "Super admins can manage organization_profile" ON organization_profile;
DROP POLICY IF EXISTS "Super admins can manage blog_posts" ON blog_posts;
DROP POLICY IF EXISTS "Super admins can manage newsletter_subscribers" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Super admins can manage admin_invites" ON admin_invites;
DROP POLICY IF EXISTS "Super admins can manage audit_logs" ON audit_logs;

-- Drop patient_records bypass policy if it exists
DROP POLICY IF EXISTS "Super admins can manage patient_records" ON patient_records;

-- Drop messages bypass policy if it exists
DROP POLICY IF EXISTS "Super admins can manage messages" ON messages;

-- Note: Super admins will still have full access through existing RLS policies
-- in migration 002_rls_policies.sql which already include 'super_admin' in role checks
