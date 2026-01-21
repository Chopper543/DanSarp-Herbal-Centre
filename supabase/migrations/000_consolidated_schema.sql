-- ============================================================================
-- CONSOLIDATED DATABASE SCHEMA
-- ============================================================================
-- This file consolidates all 21 migration files into a single, clean schema
-- representing the final state of the database.
--
-- IMPORTANT: This migration is for NEW projects or database resets.
-- For existing databases, ensure this matches your current state.
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- SECTION 2: CUSTOM TYPES AND ENUMS
-- ============================================================================

-- User roles enum
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'admin',
  'content_manager',
  'appointment_manager',
  'finance_manager',
  'user'
);

-- Appointment status enum
CREATE TYPE appointment_status AS ENUM (
  'pending',
  'confirmed',
  'completed',
  'cancelled'
);

-- Gallery item type enum
CREATE TYPE gallery_item_type AS ENUM (
  'doctor',
  'event',
  'clinic',
  'achievement'
);

-- Testimonial media type enum
CREATE TYPE testimonial_media_type AS ENUM (
  'image',
  'audio',
  'video'
);

-- Payment method enum
CREATE TYPE payment_method AS ENUM (
  'mtn_momo',
  'vodafone_cash',
  'airteltigo',
  'bank_transfer',
  'card',
  'ghqr',
  'wallet',
  'cod'
);

-- Payment status enum (includes 'expired' from migration 018)
CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'expired'
);

-- Transaction type enum
CREATE TYPE transaction_type AS ENUM (
  'deposit',
  'payment',
  'refund'
);

-- Blog post status enum
CREATE TYPE blog_post_status AS ENUM (
  'draft',
  'published'
);

-- Gender type enum (from patient_records migration)
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- Marital status type enum (from patient_records migration)
CREATE TYPE marital_status_type AS ENUM ('single', 'married', 'divorced', 'widowed', 'separated');

-- ============================================================================
-- SECTION 3: TABLE DEFINITIONS
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  bio TEXT,
  preferences JSONB DEFAULT '{"theme": "light", "notifications": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (extends auth.users with custom fields)
-- Includes: two_factor_secret, two_factor_backup_codes (migration 021)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role user_role DEFAULT 'user',
  email_verified BOOLEAN DEFAULT FALSE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  two_factor_backup_codes TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branches table (includes image_urls from migration 009)
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  coordinates POINT NOT NULL,
  working_hours JSONB NOT NULL,
  image_urls JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Treatments table
CREATE TABLE treatments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  pricing JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  appointment_date TIMESTAMPTZ NOT NULL,
  status appointment_status DEFAULT 'pending',
  treatment_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gallery items table
CREATE TABLE gallery_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type gallery_item_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_urls TEXT[] DEFAULT '{}',
  video_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Testimonials table
CREATE TABLE testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_name TEXT,
  content TEXT NOT NULL,
  media_type testimonial_media_type NOT NULL,
  media_url TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'GHS',
  payment_method payment_method NOT NULL,
  status payment_status DEFAULT 'pending',
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment ledger table
CREATE TABLE payment_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  transaction_type transaction_type NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization profile table
CREATE TABLE organization_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission TEXT NOT NULL,
  vision TEXT NOT NULL,
  values TEXT NOT NULL,
  team_members JSONB DEFAULT '[]'::jsonb,
  certifications JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog posts table
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  featured_image_url TEXT,
  status blog_post_status DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Newsletter subscribers table
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin invites table
CREATE TABLE admin_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table (from migration 011)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient records table (from migration 015)
CREATE TABLE patient_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Demographics
  date_of_birth DATE,
  age INTEGER,
  gender gender_type,
  marital_status marital_status_type,
  occupation TEXT,
  
  -- Contact Information
  home_address TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  alternative_phone TEXT,
  
  -- Emergency Contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  
  -- Medical Information
  primary_condition TEXT,
  condition_started_date DATE,
  medical_history JSONB DEFAULT '[]'::jsonb,
  allergies TEXT[],
  current_medications TEXT[],
  blood_type TEXT,
  
  -- Visit Tracking
  first_visit_date TIMESTAMPTZ,
  last_visit_date TIMESTAMPTZ,
  total_visits INTEGER DEFAULT 0,
  
  -- Doctor's Reports/Notes
  doctor_notes JSONB DEFAULT '[]'::jsonb,
  
  -- Additional Information
  insurance_provider TEXT,
  insurance_number TEXT,
  referral_source TEXT,
  preferred_language TEXT DEFAULT 'en',
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- SECTION 4: INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_two_factor_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE;

-- Appointments indexes
CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_branch_id ON appointments(branch_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Reviews indexes
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_approved ON reviews(is_approved);

-- Gallery items indexes
CREATE INDEX idx_gallery_items_type ON gallery_items(type);
CREATE INDEX idx_gallery_items_featured ON gallery_items(is_featured);

-- Payments indexes
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider_transaction_id ON payments(provider_transaction_id);

-- Payment ledger indexes
CREATE INDEX idx_payment_ledger_payment_id ON payment_ledger(payment_id);

-- Blog posts indexes
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Messages indexes (from migration 011)
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_messages_appointment_id ON messages(appointment_id);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Patient records indexes (from migration 015)
CREATE INDEX idx_patient_records_user_id ON patient_records(user_id);
CREATE INDEX idx_patient_records_condition ON patient_records(primary_condition);
CREATE INDEX idx_patient_records_last_visit ON patient_records(last_visit_date DESC);
CREATE INDEX idx_patient_records_first_visit ON patient_records(first_visit_date);

-- ============================================================================
-- SECTION 5: FUNCTIONS
-- ============================================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  old_data JSONB;
  new_data JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type := 'create';
    new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    action_type := 'update';
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'delete';
    old_data := to_jsonb(OLD);
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    auth.uid(),
    action_type,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'old', old_data,
      'new', new_data
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync auth.users with users table (latest version from migration 020)
CREATE OR REPLACE FUNCTION sync_user_from_auth()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
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

-- Function to update payment ledger
CREATE OR REPLACE FUNCTION update_payment_ledger()
RETURNS TRIGGER AS $$
DECLARE
  current_balance DECIMAL(10, 2);
  transaction_type_val transaction_type;
BEGIN
  -- Determine transaction type based on payment status
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    transaction_type_val := 'payment';
    
    -- Calculate current balance (sum of all completed payments)
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM payments
    WHERE user_id = NEW.user_id AND status = 'completed';
    
    -- Insert ledger entry
    INSERT INTO payment_ledger (
      payment_id,
      transaction_type,
      amount,
      balance_after
    ) VALUES (
      NEW.id,
      transaction_type_val,
      NEW.amount,
      current_balance
    );
  ELSIF NEW.status = 'refunded' AND OLD.status != 'refunded' THEN
    transaction_type_val := 'refund';
    
    -- Calculate current balance after refund
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM payments
    WHERE user_id = NEW.user_id 
      AND status = 'completed'
      AND id != NEW.id;
    
    -- Insert ledger entry for refund
    INSERT INTO payment_ledger (
      payment_id,
      transaction_type,
      amount,
      balance_after
    ) VALUES (
      NEW.id,
      transaction_type_val,
      -NEW.amount,
      current_balance
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper functions for RLS (from migration 008)
-- Function to check if current user has admin role
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

-- Function to check if current user is super_admin or admin
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

-- Function to check if current user is super_admin
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

-- Grant execute permissions for helper functions
GRANT EXECUTE ON FUNCTION is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_user() TO anon;
GRANT EXECUTE ON FUNCTION is_super_admin_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin_or_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO anon;

-- Function to update messages updated_at (from migration 011)
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically update age from date_of_birth (from migration 015)
CREATE OR REPLACE FUNCTION update_patient_age()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN
    NEW.age = EXTRACT(YEAR FROM AGE(NEW.date_of_birth));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update last_visit_date when appointment is completed (from migration 015)
CREATE OR REPLACE FUNCTION update_patient_last_visit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE patient_records
    SET 
      last_visit_date = NEW.appointment_date,
      total_visits = total_visits + 1
    WHERE user_id = NEW.user_id;
    
    -- Also update first_visit_date if it's null
    UPDATE patient_records
    SET first_visit_date = NEW.appointment_date
    WHERE user_id = NEW.user_id AND first_visit_date IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Audit triggers for sensitive tables
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_appointments
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_reviews
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_admin_invites
  AFTER INSERT OR UPDATE OR DELETE ON admin_invites
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- ============================================================================
-- SECTION 7: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_records ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Allow profile creation via trigger"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users policies
CREATE POLICY "Users can view their own user record"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (is_super_admin_or_admin());

CREATE POLICY "Allow user creation via trigger"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Branches policies
CREATE POLICY "Anyone can view active branches"
  ON branches FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage branches"
  ON branches FOR ALL
  USING (is_super_admin_or_admin());

-- Treatments policies
CREATE POLICY "Anyone can view active treatments"
  ON treatments FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage treatments"
  ON treatments FOR ALL
  USING (is_admin_user());

-- Appointments policies
CREATE POLICY "Users can view their own appointments"
  ON appointments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create appointments"
  ON appointments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments"
  ON appointments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all appointments"
  ON appointments FOR SELECT
  USING (is_admin_user());

CREATE POLICY "Admins can update all appointments"
  ON appointments FOR UPDATE
  USING (is_admin_user());

-- Reviews policies
CREATE POLICY "Anyone can view approved reviews"
  ON reviews FOR SELECT
  USING (is_approved = TRUE);

CREATE POLICY "Users can view their own reviews"
  ON reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all reviews"
  ON reviews FOR SELECT
  USING (is_admin_user());

CREATE POLICY "Admins can update reviews"
  ON reviews FOR UPDATE
  USING (is_admin_user());

-- Gallery items policies
CREATE POLICY "Anyone can view gallery items"
  ON gallery_items FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage gallery items"
  ON gallery_items FOR ALL
  USING (is_admin_user());

-- Testimonials policies
CREATE POLICY "Anyone can view approved testimonials"
  ON testimonials FOR SELECT
  USING (is_approved = TRUE);

CREATE POLICY "Admins can view all testimonials"
  ON testimonials FOR SELECT
  USING (is_admin_user());

CREATE POLICY "Admins can manage testimonials"
  ON testimonials FOR ALL
  USING (is_admin_user());

-- Payments policies
CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  USING (is_admin_user());

CREATE POLICY "Admins can update payments"
  ON payments FOR UPDATE
  USING (is_admin_user());

-- Payment ledger policies
CREATE POLICY "Admins can view payment ledger"
  ON payment_ledger FOR SELECT
  USING (is_admin_user());

-- Organization profile policies
CREATE POLICY "Anyone can view organization profile"
  ON organization_profile FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage organization profile"
  ON organization_profile FOR ALL
  USING (is_admin_user());

-- Blog posts policies
CREATE POLICY "Anyone can view published blog posts"
  ON blog_posts FOR SELECT
  USING (status = 'published');

CREATE POLICY "Users can view their own blog posts"
  ON blog_posts FOR SELECT
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can create blog posts"
  ON blog_posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own blog posts"
  ON blog_posts FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Admins can manage all blog posts"
  ON blog_posts FOR ALL
  USING (is_admin_user());

-- Newsletter subscribers policies
CREATE POLICY "Anyone can subscribe"
  ON newsletter_subscribers FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Admins can view subscribers"
  ON newsletter_subscribers FOR SELECT
  USING (is_admin_user());

-- Admin invites policies
CREATE POLICY "Admins can view invites"
  ON admin_invites FOR SELECT
  USING (is_super_admin_or_admin());

CREATE POLICY "Super admins can create invites"
  ON admin_invites FOR INSERT
  WITH CHECK (is_super_admin());

-- Audit logs policies
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (is_super_admin_or_admin());

-- Messages policies (from migration 011)
CREATE POLICY "Users can view their own messages"
  ON messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update received messages"
  ON messages FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "Admins can view all messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'appointment_manager')
    )
  );

-- Patient records policies (from migration 015)
CREATE POLICY "Patients can view their own records"
  ON patient_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Patients can update their own basic info"
  ON patient_records FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all patient records"
  ON patient_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'appointment_manager')
    )
  );

CREATE POLICY "Admins can insert patient records"
  ON patient_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'appointment_manager')
    )
  );

CREATE POLICY "Admins can update all patient records"
  ON patient_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'appointment_manager')
    )
  );

CREATE POLICY "Admins can delete patient records"
  ON patient_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- ============================================================================
-- SECTION 8: STORAGE POLICIES
-- ============================================================================

-- Storage policies for avatars bucket (from migration 013)
-- IMPORTANT: Before running this migration, manually create the "avatars" storage bucket
-- in Supabase Dashboard → Storage

DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================================================
-- SECTION 9: COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN branches.image_urls IS 'Array of image URLs for branch photos. Format: ["url1", "url2"]';
COMMENT ON COLUMN users.two_factor_secret IS 'Base32 encoded TOTP secret for 2FA. Should be encrypted in production.';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'Array of backup codes for 2FA recovery. Should be hashed in production.';
COMMENT ON TABLE patient_records IS 'Comprehensive patient medical records including demographics, medical history, and visit tracking';
COMMENT ON COLUMN patient_records.doctor_notes IS 'JSONB array of doctor reports: [{"date": "ISO date", "doctor": "name", "report": "text", "attachments": ["urls"]}]';
COMMENT ON COLUMN patient_records.medical_history IS 'JSONB array of past conditions: [{"condition": "name", "started": "date", "ended": "date", "notes": "text"}]';

-- ============================================================================
-- SECTION 10: DATA MIGRATIONS
-- ============================================================================

-- Insert initial treatments (from migration 007)
INSERT INTO treatments (name, slug, description, condition_type, pricing, is_active)
VALUES (
  'Cancer Care (Holistic Support)',
  'cancer-care',
  'Cancer involves abnormal cell growth. Our herbal therapies focus on strengthening immunity, easing symptoms, and supporting recovery alongside conventional care.',
  'cancer',
  '{
    "consultation": 500,
    "monthly_therapy": {"min": 2000, "max": 3500},
    "lifestyle_coaching": 800,
    "follow_up": 400
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  condition_type = EXCLUDED.condition_type,
  pricing = EXCLUDED.pricing,
  updated_at = NOW();

INSERT INTO treatments (name, slug, description, condition_type, pricing, is_active)
VALUES (
  'Diabetes Management',
  'diabetes-management',
  'Diabetes is a condition where blood sugar regulation is impaired. We provide herbal blends, dietary guidance, and lifestyle support to help balance glucose levels naturally.',
  'diabetes',
  '{
    "consultation": 400,
    "monthly_therapy": {"min": 1500, "max": 2500},
    "nutrition_coaching": 700,
    "monitoring": 300
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  condition_type = EXCLUDED.condition_type,
  pricing = EXCLUDED.pricing,
  updated_at = NOW();

INSERT INTO treatments (name, slug, description, condition_type, pricing, is_active)
VALUES (
  'Hypertension (High Blood Pressure)',
  'hypertension',
  'Hypertension is persistently elevated blood pressure that can affect heart health. Our herbal remedies and stress-management programs aim to regulate pressure and improve circulation.',
  'hypertension',
  '{
    "consultation": 350,
    "monthly_therapy": {"min": 1200, "max": 2000},
    "stress_management_coaching": 600,
    "follow_up": 250
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  condition_type = EXCLUDED.condition_type,
  pricing = EXCLUDED.pricing,
  updated_at = NOW();

INSERT INTO treatments (name, slug, description, condition_type, pricing, is_active)
VALUES (
  'Infertility Support',
  'infertility-support',
  'Infertility can arise from hormonal, lifestyle, or health factors. We use herbal formulations, nutritional support, and counseling to promote reproductive health.',
  'infertility',
  '{
    "consultation": 600,
    "monthly_therapy": {"min": 2500, "max": 4000},
    "counseling": 900,
    "monitoring": 400
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  condition_type = EXCLUDED.condition_type,
  pricing = EXCLUDED.pricing,
  updated_at = NOW();

INSERT INTO treatments (name, slug, description, condition_type, pricing, is_active)
VALUES (
  'General Wellness & Immunity Boost',
  'general-wellness',
  'For individuals seeking preventive care, we offer herbal tonics and lifestyle programs to strengthen immunity and maintain vitality.',
  'wellness',
  '{
    "consultation": 300,
    "monthly_therapy": {"min": 1000, "max": 1800},
    "wellness_coaching": 500,
    "follow_up": 200
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  condition_type = EXCLUDED.condition_type,
  pricing = EXCLUDED.pricing,
  updated_at = NOW();

-- Insert branches (from migration 010)
DO $$
DECLARE
  default_working_hours JSONB := '{
    "monday": {"open": "08:00", "close": "17:00"},
    "tuesday": {"open": "08:00", "close": "17:00"},
    "wednesday": {"open": "08:00", "close": "17:00"},
    "thursday": {"open": "08:00", "close": "17:00"},
    "friday": {"open": "08:00", "close": "17:00"},
    "saturday": {"open": "09:00", "close": "14:00"},
    "sunday": {"closed": true}
  }'::jsonb;
BEGIN
  -- Branch 1: Nkawkaw
  INSERT INTO branches (name, address, phone, email, coordinates, working_hours, image_urls, is_active)
  SELECT
    'Nkawkaw Branch',
    'Oframase New Road, Nkawkaw',
    '0246906739',
    'info@dansarpherbal.com',
    POINT(-0.7667, 6.5500),
    default_working_hours,
    '[]'::jsonb,
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM branches WHERE name = 'Nkawkaw Branch'
  );

  -- Branch 2: Koforidua
  INSERT INTO branches (name, address, phone, email, coordinates, working_hours, image_urls, is_active)
  SELECT
    'Koforidua Branch',
    'Gyamfikrom-Guabeng, North Koforidua',
    '0246225405',
    'info@dansarpherbal.com',
    POINT(-0.2667, 6.0833),
    default_working_hours,
    '[]'::jsonb,
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM branches WHERE name = 'Koforidua Branch'
  );
END $$;


-- ============================================================================
-- CONSOLIDATION COMPLETE
-- ============================================================================
-- This consolidated schema replaces all 21 individual migration files.
-- 
-- To use this file:
-- 1. For NEW projects: Apply this single migration file
-- 2. For EXISTING projects: Verify this matches your current database state
-- 3. Archive or remove old migration files (001-021) after verification
-- ============================================================================
-- ============================================================================
