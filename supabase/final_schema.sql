-- Final consolidated schema for fresh Supabase project
-- Order: extensions -> types -> tables -> indexes -> functions -> triggers -> RLS -> storage policies -> seed data

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Types
CREATE TYPE user_role AS ENUM (
  'super_admin','admin','content_manager','appointment_manager','finance_manager','doctor','nurse','user'
);
CREATE TYPE appointment_status AS ENUM ('pending','confirmed','completed','cancelled');
CREATE TYPE gallery_item_type AS ENUM ('doctor','event','clinic','achievement');
CREATE TYPE testimonial_media_type AS ENUM ('image','audio','video');
CREATE TYPE payment_method AS ENUM ('mtn_momo','vodafone_cash','airteltigo','bank_transfer','card','ghqr','wallet','cod');
CREATE TYPE payment_status AS ENUM ('pending','processing','completed','failed','refunded','expired');
CREATE TYPE transaction_type AS ENUM ('deposit','payment','refund');
CREATE TYPE blog_post_status AS ENUM ('draft','published');
CREATE TYPE gender_type AS ENUM ('male','female','other','prefer_not_to_say');
CREATE TYPE marital_status_type AS ENUM ('single','married','divorced','widowed','separated');
CREATE TYPE prescription_status AS ENUM ('draft','active','completed','cancelled','expired');
CREATE TYPE treatment_plan_status AS ENUM ('draft','active','completed','cancelled','on_hold');
CREATE TYPE availability_type AS ENUM ('working_hours','time_off','holiday','emergency');
CREATE TYPE lab_result_status AS ENUM ('pending','in_progress','completed','cancelled','reviewed');
CREATE TYPE clinical_note_type AS ENUM ('soap','progress','general');
CREATE TYPE intake_form_response_status AS ENUM ('draft','submitted','reviewed','approved','rejected');

-- Tables
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  bio TEXT,
  preferences JSONB DEFAULT '{"theme": "light", "notifications": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
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

CREATE TABLE IF NOT EXISTS branches (
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

CREATE TABLE IF NOT EXISTS treatments (
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

CREATE TABLE IF NOT EXISTS appointments (
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

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gallery_items (
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

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_name TEXT,
  content TEXT NOT NULL,
  media_type testimonial_media_type NOT NULL,
  media_url TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'GHS',
  payment_method payment_method NOT NULL,
  status payment_status DEFAULT 'pending',
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  transaction_type transaction_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission TEXT NOT NULL,
  vision TEXT NOT NULL,
  values TEXT NOT NULL,
  team_members JSONB DEFAULT '[]'::jsonb,
  certifications JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
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

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- audit_logs upgraded definition
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_status_created_at ON deletion_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id ON deletion_requests(user_id);

CREATE TABLE IF NOT EXISTS messages (
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

CREATE TABLE IF NOT EXISTS patient_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth DATE,
  age INTEGER,
  gender gender_type,
  marital_status marital_status_type,
  occupation TEXT,
  home_address TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  alternative_phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  primary_condition TEXT,
  condition_started_date DATE,
  medical_history JSONB DEFAULT '[]'::jsonb,
  allergies TEXT[],
  current_medications TEXT[],
  blood_type TEXT,
  first_visit_date TIMESTAMPTZ,
  last_visit_date TIMESTAMPTZ,
  total_visits INTEGER DEFAULT 0,
  doctor_notes JSONB DEFAULT '[]'::jsonb,
  insurance_provider TEXT,
  insurance_number TEXT,
  referral_source TEXT,
  preferred_language TEXT DEFAULT 'en',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  herbs_formulas JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions TEXT,
  duration_days INTEGER,
  refills_remaining INTEGER DEFAULT 0,
  refills_original INTEGER DEFAULT 0,
  prescribed_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date DATE,
  start_date DATE,
  end_date DATE,
  status prescription_status DEFAULT 'draft',
  doctor_notes TEXT,
  patient_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS prescription_refills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_date TIMESTAMPTZ DEFAULT NOW(),
  requested_refills INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','fulfilled')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Treatment plans
CREATE TABLE IF NOT EXISTS treatment_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  diagnosis TEXT,
  goals TEXT[],
  treatment_approach TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  estimated_duration_days INTEGER,
  status treatment_plan_status DEFAULT 'draft',
  progress_notes JSONB DEFAULT '[]'::jsonb,
  current_progress INTEGER DEFAULT 0 CHECK (current_progress BETWEEN 0 AND 100),
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_interval_days INTEGER,
  next_follow_up_date DATE,
  template_id UUID,
  doctor_notes TEXT,
  patient_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS treatment_plan_followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  treatment_plan_id UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  follow_up_type TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','missed')),
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doctor availability
CREATE TABLE IF NOT EXISTS doctor_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type availability_type DEFAULT 'working_hours',
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME,
  end_time TIME,
  start_date DATE,
  end_date DATE,
  start_datetime TIMESTAMPTZ,
  end_datetime TIMESTAMPTZ,
  notes TEXT,
  reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Lab results
CREATE TABLE IF NOT EXISTS lab_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  test_name TEXT NOT NULL,
  test_type TEXT,
  ordered_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_date DATE,
  results JSONB DEFAULT '{}'::jsonb,
  normal_range TEXT,
  units TEXT,
  file_urls TEXT[] DEFAULT '{}',
  status lab_result_status DEFAULT 'pending',
  notes TEXT,
  doctor_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Clinical notes
CREATE TABLE IF NOT EXISTS clinical_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  note_type clinical_note_type DEFAULT 'soap',
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  vital_signs JSONB DEFAULT '{}'::jsonb,
  diagnosis_codes TEXT[] DEFAULT '{}',
  template_id UUID,
  is_template BOOLEAN DEFAULT FALSE,
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Intake forms
CREATE TABLE IF NOT EXISTS intake_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  form_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  required_for_booking BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS intake_form_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES intake_forms(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  response_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status intake_form_response_status DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointment waitlist
CREATE TABLE IF NOT EXISTS appointment_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  preferred_date DATE,
  preferred_time TIME,
  treatment_type TEXT,
  priority INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','notified','booked','cancelled')),
  notified_at TIMESTAMPTZ,
  booked_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health metrics
CREATE TABLE IF NOT EXISTS health_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value NUMERIC,
  unit TEXT,
  value_text TEXT,
  notes TEXT,
  metadata JSONB,
  recorded_date DATE NOT NULL,
  recorded_time TIME,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (core subset)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_branch_id ON appointments(branch_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_transaction_id_unique
ON payments(provider_transaction_id)
WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_patient_records_user_id ON patient_records(user_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescription_refills_prescription_id ON prescription_refills(prescription_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient_id ON treatment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plan_followups_plan_id ON treatment_plan_followups(treatment_plan_id);
CREATE INDEX IF NOT EXISTS idx_doctor_availability_doctor_id ON doctor_availability(doctor_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_patient_id ON lab_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient_id ON clinical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_intake_forms_is_active ON intake_forms(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_intake_form_responses_form_id ON intake_form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_patient_id ON appointment_waitlist(patient_id);
CREATE INDEX IF NOT EXISTS idx_health_metrics_patient_id ON health_metrics(patient_id);

-- Functions (all set search_path)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('search_path','public,extensions',true);
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_payment_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_balance DECIMAL(10, 2);
  transaction_type_val transaction_type;
BEGIN
  PERFORM set_config('search_path','public,extensions',true);

  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    transaction_type_val := 'payment';
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM payments
    WHERE user_id = NEW.user_id AND status = 'completed';
    INSERT INTO payment_ledger (payment_id, transaction_type, amount, balance_after)
    VALUES (NEW.id, transaction_type_val, NEW.amount, current_balance);
  ELSIF NEW.status = 'refunded' AND OLD.status != 'refunded' THEN
    transaction_type_val := 'refund';
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM payments
    WHERE user_id = NEW.user_id AND status = 'completed' AND id != NEW.id;
    INSERT INTO payment_ledger (payment_id, transaction_type, amount, balance_after)
    VALUES (NEW.id, transaction_type_val, -NEW.amount, current_balance);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_user_from_auth()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM set_config('search_path','public,extensions',true);
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
    full_name = COALESCE(EXCLUDED.full_name, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')),
    phone = COALESCE(EXCLUDED.phone, NEW.phone, NEW.raw_user_meta_data->>'phone'),
    email_verified = NEW.email_confirmed_at IS NOT NULL,
    updated_at = NOW();

  INSERT INTO profiles (id, created_at, updated_at)
  VALUES (NEW.id, COALESCE(NEW.created_at, NOW()), NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in sync_user_from_auth for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
DECLARE user_role_text TEXT;
BEGIN
  PERFORM set_config('search_path','public,extensions',true);
  -- Legacy broad back-office check (includes non-clinical managers).
  SELECT role INTO user_role_text FROM users WHERE id = (select auth.uid());
  RETURN user_role_text IN ('super_admin','admin','content_manager','appointment_manager','finance_manager','doctor','nurse');
END;
$$;

CREATE OR REPLACE FUNCTION is_finance_staff_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
DECLARE user_role_text TEXT;
BEGIN
  PERFORM set_config('search_path','public,extensions',true);
  SELECT role INTO user_role_text FROM users WHERE id = (select auth.uid());
  RETURN user_role_text IN ('super_admin','admin','finance_manager');
END;
$$;

CREATE OR REPLACE FUNCTION is_messages_staff_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
DECLARE user_role_text TEXT;
BEGIN
  PERFORM set_config('search_path','public,extensions',true);
  SELECT role INTO user_role_text FROM users WHERE id = (select auth.uid());
  RETURN user_role_text IN ('super_admin','admin','appointment_manager','doctor','nurse');
END;
$$;

CREATE OR REPLACE FUNCTION is_clinical_staff_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
DECLARE user_role_text TEXT;
BEGIN
  PERFORM set_config('search_path','public,extensions',true);
  SELECT role INTO user_role_text FROM users WHERE id = (select auth.uid());
  RETURN user_role_text IN ('super_admin','admin','doctor','nurse');
END;
$$;

CREATE OR REPLACE FUNCTION is_patient_records_staff_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
DECLARE user_role_text TEXT;
BEGIN
  PERFORM set_config('search_path','public,extensions',true);
  SELECT role INTO user_role_text FROM users WHERE id = (select auth.uid());
  RETURN user_role_text IN ('super_admin','admin','appointment_manager','doctor','nurse');
END;
$$;

CREATE OR REPLACE FUNCTION is_prescriptions_staff_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
DECLARE user_role_text TEXT;
BEGIN
  PERFORM set_config('search_path','public,extensions',true);
  SELECT role INTO user_role_text FROM users WHERE id = (select auth.uid());
  RETURN user_role_text IN ('super_admin','admin','doctor','nurse');
END;
$$;

CREATE OR REPLACE FUNCTION is_super_admin_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
DECLARE user_role_text TEXT;
BEGIN
  PERFORM set_config('search_path','public,extensions',true);
  SELECT role INTO user_role_text FROM users WHERE id = (select auth.uid());
  RETURN user_role_text IN ('super_admin','admin');
END;
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
DECLARE user_role_text TEXT;
BEGIN
  PERFORM set_config('search_path','public,extensions',true);
  SELECT role INTO user_role_text FROM users WHERE id = (select auth.uid());
  RETURN user_role_text = 'super_admin';
END;
$$;

CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  action_type TEXT;
  old_data JSONB;
  new_data JSONB;
BEGIN
  PERFORM set_config('search_path','public,extensions',true);

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

  INSERT INTO audit_logs (
    table_name, record_id, action, old_data, new_data, user_id, created_at, resource_type, resource_id
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    action_type,
    old_data,
    new_data,
    (select auth.uid()),
    NOW(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Generic update helpers for tables with updated_at
CREATE OR REPLACE FUNCTION update_messages_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('search_path','public,extensions',true); NEW.updated_at := NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION update_patient_age() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('search_path','public,extensions',true); IF NEW.date_of_birth IS NOT NULL THEN NEW.age := EXTRACT(YEAR FROM AGE(NEW.date_of_birth)); END IF; RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION update_patient_last_visit() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('search_path','public,extensions',true);
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE patient_records SET last_visit_date = NEW.appointment_date, total_visits = total_visits + 1 WHERE user_id = NEW.user_id;
    UPDATE patient_records SET first_visit_date = NEW.appointment_date WHERE user_id = NEW.user_id AND first_visit_date IS NULL;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION update_prescriptions_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('search_path','public,extensions',true); NEW.updated_at := NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION update_prescription_refills_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('search_path','public,extensions',true); NEW.updated_at := NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION update_treatment_plans_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('search_path','public,extensions',true); NEW.updated_at := NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION update_doctor_availability_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('search_path','public,extensions',true); NEW.updated_at := NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION update_lab_results_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('search_path','public,extensions',true); NEW.updated_at := NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION update_clinical_notes_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('search_path','public,extensions',true); NEW.updated_at := NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION update_intake_forms_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('search_path','public,extensions',true); NEW.updated_at := NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION update_waitlist_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('search_path','public,extensions',true); NEW.updated_at := NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION update_health_metrics_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('search_path','public,extensions',true); NEW.updated_at := NOW(); RETURN NEW; END; $$;

-- Triggers
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_appointments AFTER INSERT OR UPDATE OR DELETE ON appointments FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_reviews AFTER INSERT OR UPDATE OR DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_admin_invites AFTER INSERT OR UPDATE OR DELETE ON admin_invites FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_messages_updated_at();
CREATE TRIGGER patient_age_before_insupd BEFORE INSERT OR UPDATE ON patient_records FOR EACH ROW EXECUTE FUNCTION update_patient_age();
CREATE TRIGGER appointments_last_visit BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_patient_last_visit();
CREATE TRIGGER prescriptions_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION update_prescriptions_updated_at();
CREATE TRIGGER prescription_refills_updated_at BEFORE UPDATE ON prescription_refills FOR EACH ROW EXECUTE FUNCTION update_prescription_refills_updated_at();
CREATE TRIGGER treatment_plans_updated_at BEFORE UPDATE ON treatment_plans FOR EACH ROW EXECUTE FUNCTION update_treatment_plans_updated_at();
CREATE TRIGGER treatment_plan_followups_updated_at BEFORE UPDATE ON treatment_plan_followups FOR EACH ROW EXECUTE FUNCTION update_treatment_plans_updated_at();
CREATE TRIGGER doctor_availability_updated_at BEFORE UPDATE ON doctor_availability FOR EACH ROW EXECUTE FUNCTION update_doctor_availability_updated_at();
CREATE TRIGGER lab_results_updated_at BEFORE UPDATE ON lab_results FOR EACH ROW EXECUTE FUNCTION update_lab_results_updated_at();
CREATE TRIGGER clinical_notes_updated_at BEFORE UPDATE ON clinical_notes FOR EACH ROW EXECUTE FUNCTION update_clinical_notes_updated_at();
CREATE TRIGGER intake_forms_updated_at BEFORE UPDATE ON intake_forms FOR EACH ROW EXECUTE FUNCTION update_intake_forms_updated_at();
CREATE TRIGGER intake_form_responses_updated_at BEFORE UPDATE ON intake_form_responses FOR EACH ROW EXECUTE FUNCTION update_intake_forms_updated_at();
CREATE TRIGGER waitlist_updated_at BEFORE UPDATE ON appointment_waitlist FOR EACH ROW EXECUTE FUNCTION update_waitlist_updated_at();
CREATE TRIGGER health_metrics_updated_at BEFORE UPDATE ON health_metrics FOR EACH ROW EXECUTE FUNCTION update_health_metrics_updated_at();
CREATE TRIGGER deletion_requests_updated_at BEFORE UPDATE ON deletion_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auth sync trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_from_auth();

-- Enable RLS
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
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_refills ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plan_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid duplicates
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, schemaname, tablename FROM pg_policies WHERE schemaname='public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END$$;

-- RLS policies (using (select auth.uid()))
-- Profiles
CREATE POLICY profiles_select_self ON profiles FOR SELECT USING ((select auth.uid()) = id);
CREATE POLICY profiles_update_self ON profiles FOR UPDATE USING ((select auth.uid()) = id);
CREATE POLICY profiles_insert_self ON profiles FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- Users
CREATE POLICY users_select_self ON users FOR SELECT USING ((select auth.uid()) = id OR (select is_super_admin_or_admin()));
CREATE POLICY users_insert_self ON users FOR INSERT WITH CHECK ((select auth.uid()) = id);
CREATE POLICY users_update_admin ON users FOR UPDATE USING ((select is_super_admin_or_admin()));

-- Branches
CREATE POLICY branches_select ON branches FOR SELECT USING (is_active = TRUE OR (select is_super_admin_or_admin()));
CREATE POLICY branches_manage ON branches FOR ALL USING ((select is_super_admin_or_admin()));

-- Treatments
CREATE POLICY treatments_select ON treatments FOR SELECT USING (is_active = TRUE);
CREATE POLICY treatments_manage ON treatments FOR ALL USING ((select is_admin_user()));

-- Appointments
CREATE POLICY appt_select ON appointments FOR SELECT USING (((select auth.uid()) = user_id) OR (select is_admin_user()));
CREATE POLICY appt_insert ON appointments FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY appt_update ON appointments FOR UPDATE USING (((select auth.uid()) = user_id) OR (select is_admin_user()));

-- Reviews
CREATE POLICY reviews_select ON reviews FOR SELECT USING (is_approved = TRUE OR (select auth.uid()) = user_id OR (select is_admin_user()));
CREATE POLICY reviews_insert ON reviews FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY reviews_update_admin ON reviews FOR UPDATE USING ((select is_admin_user()));

-- Gallery items
CREATE POLICY gallery_select ON gallery_items FOR SELECT USING (TRUE);
CREATE POLICY gallery_manage ON gallery_items FOR ALL USING ((select is_admin_user()));

-- Testimonials
CREATE POLICY testimonials_select ON testimonials FOR SELECT USING (is_approved = TRUE OR (select is_admin_user()));
CREATE POLICY testimonials_manage ON testimonials FOR ALL USING ((select is_admin_user()));

-- Payments
CREATE POLICY payments_select ON payments FOR SELECT USING (((select auth.uid()) = user_id) OR (select is_finance_staff_user()));
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY payments_update_admin ON payments FOR UPDATE USING ((select is_finance_staff_user()));

-- Payment ledger
CREATE POLICY ledger_select_admin ON payment_ledger FOR SELECT USING ((select is_finance_staff_user()));

-- Organization profile
CREATE POLICY org_select ON organization_profile FOR SELECT USING (TRUE);
CREATE POLICY org_manage ON organization_profile FOR ALL USING ((select is_admin_user()));

-- Blog posts
CREATE POLICY blog_select ON blog_posts FOR SELECT USING ((status = 'published') OR (select auth.uid()) = author_id OR (select is_admin_user()));
CREATE POLICY blog_insert_author ON blog_posts FOR INSERT WITH CHECK (((select auth.uid()) = author_id) OR (select is_admin_user()));
CREATE POLICY blog_update_author ON blog_posts FOR UPDATE USING (((select auth.uid()) = author_id) OR (select is_admin_user()));

-- Newsletter
CREATE POLICY newsletter_insert ON newsletter_subscribers FOR INSERT WITH CHECK (TRUE);
CREATE POLICY newsletter_select_admin ON newsletter_subscribers FOR SELECT USING ((select is_admin_user()));

-- Admin invites
CREATE POLICY invites_select_admin ON admin_invites FOR SELECT USING ((select is_super_admin_or_admin()));
CREATE POLICY invites_insert_super ON admin_invites FOR INSERT WITH CHECK ((select is_super_admin()));
CREATE POLICY invites_update_super ON admin_invites FOR UPDATE USING ((select is_super_admin())) WITH CHECK ((select is_super_admin()));
CREATE POLICY invites_delete_super ON admin_invites FOR DELETE USING ((select is_super_admin()));

-- Audit logs
CREATE POLICY audit_select_admin ON audit_logs FOR SELECT USING ((select is_super_admin_or_admin()));

-- Deletion requests
CREATE POLICY deletion_requests_select ON deletion_requests
FOR SELECT USING (
  ((select auth.uid()) = user_id) OR
  ((select auth.uid()) = requested_by) OR
  (select is_super_admin_or_admin())
);
CREATE POLICY deletion_requests_insert ON deletion_requests
FOR INSERT WITH CHECK (
  ((select auth.uid()) = requested_by) AND
  (((select auth.uid()) = user_id) OR (select is_super_admin_or_admin()))
);
CREATE POLICY deletion_requests_update_admin ON deletion_requests
FOR UPDATE USING ((select is_super_admin_or_admin()));

-- Messages
CREATE POLICY messages_select ON messages FOR SELECT USING (((select auth.uid()) = sender_id) OR ((select auth.uid()) = recipient_id) OR (select is_messages_staff_user()));
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK ((select auth.uid()) = sender_id);
CREATE POLICY messages_update_recipient ON messages FOR UPDATE USING (((select auth.uid()) = recipient_id));

-- Patient records
CREATE POLICY patient_select ON patient_records FOR SELECT USING (((select auth.uid()) = user_id) OR (select is_patient_records_staff_user()));
CREATE POLICY patient_insert_admin ON patient_records FOR INSERT WITH CHECK ((select is_patient_records_staff_user()));
CREATE POLICY patient_update ON patient_records FOR UPDATE USING (((select auth.uid()) = user_id) OR (select is_patient_records_staff_user())) WITH CHECK (((select auth.uid()) = user_id) OR (select is_patient_records_staff_user()));
CREATE POLICY patient_delete_admin ON patient_records FOR DELETE USING ((select is_super_admin_or_admin()));

-- Prescriptions
CREATE POLICY rx_select_patient_doctor ON prescriptions FOR SELECT USING (((select auth.uid()) = patient_id) OR ((select auth.uid()) = doctor_id) OR (select is_prescriptions_staff_user()));
CREATE POLICY rx_insert_doc_admin ON prescriptions FOR INSERT WITH CHECK (((select auth.uid()) = doctor_id) OR (select is_prescriptions_staff_user()));
CREATE POLICY rx_update_doc_admin ON prescriptions FOR UPDATE USING (((select auth.uid()) = doctor_id) OR (select is_prescriptions_staff_user()));

-- Prescription refills
CREATE POLICY rx_refill_manage_patient ON prescription_refills FOR ALL USING (((select auth.uid()) = patient_id)) WITH CHECK (((select auth.uid()) = patient_id));
CREATE POLICY rx_refill_manage_admin ON prescription_refills FOR ALL USING ((select is_prescriptions_staff_user()));

-- Treatment plans
CREATE POLICY plan_select ON treatment_plans FOR SELECT USING (((select auth.uid()) = patient_id) OR ((select auth.uid()) = doctor_id) OR (select is_admin_user()));
CREATE POLICY plan_insert ON treatment_plans FOR INSERT WITH CHECK (((select auth.uid()) = doctor_id) OR (select is_admin_user()));
CREATE POLICY plan_update ON treatment_plans FOR UPDATE USING (((select auth.uid()) = doctor_id) OR (select is_admin_user()));

-- Treatment plan followups
CREATE POLICY plan_fu_select ON treatment_plan_followups FOR SELECT USING (
  EXISTS (SELECT 1 FROM treatment_plans tp WHERE tp.id = treatment_plan_id AND ((select auth.uid()) = tp.patient_id OR (select auth.uid()) = tp.doctor_id OR (select is_admin_user())))
);
CREATE POLICY plan_fu_manage ON treatment_plan_followups FOR ALL USING (
  EXISTS (SELECT 1 FROM treatment_plans tp WHERE tp.id = treatment_plan_id AND ((select auth.uid()) = tp.doctor_id OR (select is_admin_user())))
);

-- Doctor availability
CREATE POLICY availability_select ON doctor_availability FOR SELECT USING (((select auth.uid()) = doctor_id) OR (select is_patient_records_staff_user()));
CREATE POLICY availability_manage ON doctor_availability FOR ALL USING (((select auth.uid()) = doctor_id) OR (select is_patient_records_staff_user()));

-- Lab results
CREATE POLICY lab_select ON lab_results FOR SELECT USING (((select auth.uid()) = patient_id) OR ((select auth.uid()) = doctor_id) OR (select is_clinical_staff_user()));
CREATE POLICY lab_insert ON lab_results FOR INSERT WITH CHECK (((select auth.uid()) = doctor_id) OR (select is_clinical_staff_user()));
CREATE POLICY lab_update ON lab_results FOR UPDATE USING (((select auth.uid()) = doctor_id) OR (select is_clinical_staff_user()));
CREATE POLICY lab_delete_admin ON lab_results FOR DELETE USING ((select is_super_admin_or_admin()));

-- Clinical notes
CREATE POLICY notes_select ON clinical_notes FOR SELECT USING (((select auth.uid()) = patient_id) OR ((select auth.uid()) = doctor_id) OR (select is_clinical_staff_user()));
CREATE POLICY notes_insert ON clinical_notes FOR INSERT WITH CHECK (((select auth.uid()) = doctor_id) OR (select is_clinical_staff_user()));
CREATE POLICY notes_update ON clinical_notes FOR UPDATE USING (((select auth.uid()) = doctor_id) OR (select is_clinical_staff_user()));
CREATE POLICY notes_delete_admin ON clinical_notes FOR DELETE USING ((select is_super_admin_or_admin()));

-- Intake forms
CREATE POLICY intake_forms_select ON intake_forms FOR SELECT USING (is_active = TRUE OR (select is_admin_user()));
CREATE POLICY intake_forms_manage ON intake_forms FOR ALL USING ((select is_admin_user()));

-- Intake form responses
CREATE POLICY intake_resp_select_patient ON intake_form_responses FOR SELECT USING (((select auth.uid()) = patient_id));
CREATE POLICY intake_resp_manage_patient ON intake_form_responses FOR INSERT WITH CHECK (((select auth.uid()) = patient_id));
CREATE POLICY intake_resp_update_patient ON intake_form_responses FOR UPDATE USING (((select auth.uid()) = patient_id));
CREATE POLICY intake_resp_staff_view ON intake_form_responses FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = (select auth.uid()) AND u.role IN ('admin','super_admin','appointment_manager','doctor','nurse'))
);
CREATE POLICY intake_resp_staff_update ON intake_form_responses FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = (select auth.uid()) AND u.role IN ('admin','super_admin','appointment_manager','doctor','nurse'))
);

-- Appointment waitlist
CREATE POLICY waitlist_patient ON appointment_waitlist FOR ALL USING (((select auth.uid()) = patient_id)) WITH CHECK (((select auth.uid()) = patient_id));
CREATE POLICY waitlist_admin ON appointment_waitlist FOR ALL USING ((select is_admin_user()));

-- Health metrics
CREATE POLICY metrics_patient ON health_metrics FOR ALL USING (((select auth.uid()) = patient_id)) WITH CHECK (((select auth.uid()) = patient_id));
CREATE POLICY metrics_staff_view ON health_metrics FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = (select auth.uid()) AND u.role IN ('doctor','admin','super_admin','appointment_manager'))
);

-- Payment ledger view policy already admin-only; no change needed beyond RLS enable (done)

-- Storage policies (avatars, lab-results, clinical-notes, intake-forms)
-- Drop conflicting ones first
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

-- Lab results bucket
DROP POLICY IF EXISTS "Patients can view own lab result files" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can view lab result files" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can upload lab result files" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can delete lab result files" ON storage.objects;

CREATE POLICY "Patients can view own lab result files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'lab-results' AND
  EXISTS (
    SELECT 1 FROM lab_results
    WHERE lab_results.file_urls @> ARRAY[storage.objects.name]
      AND lab_results.patient_id = (select auth.uid())
  )
);
CREATE POLICY "Doctors can view lab result files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'lab-results' AND (select is_clinical_staff_user())
);
CREATE POLICY "Doctors can upload lab result files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lab-results' AND (select is_clinical_staff_user()));
CREATE POLICY "Doctors can delete lab result files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lab-results' AND (select is_clinical_staff_user()));

-- Clinical notes bucket
DROP POLICY IF EXISTS "Patients can view own clinical note files" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can view clinical note files" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can upload clinical note files" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can delete clinical note files" ON storage.objects;

CREATE POLICY "Patients can view own clinical note files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'clinical-notes' AND
  EXISTS (
    SELECT 1 FROM clinical_notes
    WHERE clinical_notes.attachments @> ARRAY[storage.objects.name]
      AND clinical_notes.patient_id = (select auth.uid())
  )
);
CREATE POLICY "Doctors can view clinical note files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'clinical-notes' AND (select is_clinical_staff_user()));
CREATE POLICY "Doctors can upload clinical note files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'clinical-notes' AND (select is_clinical_staff_user()));
CREATE POLICY "Doctors can delete clinical note files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'clinical-notes' AND (select is_clinical_staff_user()));

-- Intake forms bucket
DROP POLICY IF EXISTS "Patients can view own intake form files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can manage intake form files" ON storage.objects;

CREATE POLICY "Patients can view own intake form files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'intake-forms' AND
  EXISTS (
    SELECT 1 FROM intake_form_responses
    WHERE intake_form_responses.response_data::text LIKE '%' || storage.objects.name || '%'
      AND intake_form_responses.patient_id = (select auth.uid())
  )
);
CREATE POLICY "Staff can manage intake form files"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'intake-forms' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
      AND users.role IN ('admin','super_admin','appointment_manager','content_manager','doctor','nurse')
  )
)
WITH CHECK (
  bucket_id = 'intake-forms' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
      AND users.role IN ('admin','super_admin','appointment_manager','content_manager','doctor','nurse')
  )
);

-- Seed data (treatments from consolidated schema)
INSERT INTO treatments (name, slug, description, condition_type, pricing, is_active)
VALUES
  ('Cancer Care (Holistic Support)','cancer-care','Cancer involves abnormal cell growth. Our herbal therapies focus on strengthening immunity, easing symptoms, and supporting recovery alongside conventional care.','cancer','{"consultation": 500, "monthly_therapy": {"min": 2000, "max": 3500}, "lifestyle_coaching": 800, "follow_up": 400}'::jsonb,true),
  ('Diabetes Management','diabetes-management','Diabetes is a condition where blood sugar regulation is impaired. We provide herbal blends, dietary guidance, and lifestyle support to help balance glucose levels naturally.','diabetes','{"consultation": 400, "monthly_therapy": {"min": 1500, "max": 2500}, "nutrition_coaching": 700, "monitoring": 300}'::jsonb,true),
  ('Hypertension (High Blood Pressure)','hypertension','Hypertension is persistently elevated blood pressure that can affect heart health. Our herbal remedies and stress-management programs aim to regulate pressure and improve circulation.','hypertension','{"consultation": 350, "monthly_therapy": {"min": 1200, "max": 2000}, "stress_management_coaching": 600, "follow_up": 250}'::jsonb,true),
  ('Infertility Support','infertility-support','Infertility can arise from hormonal, lifestyle, or health factors. We use herbal formulations, nutritional support, and counseling to promote reproductive health.','infertility','{"consultation": 600, "monthly_therapy": {"min": 2500, "max": 4000}, "counseling": 900, "monitoring": 400}'::jsonb,true),
  ('General Wellness & Immunity Boost','general-wellness','For individuals seeking preventive care, we offer herbal tonics and lifestyle programs to strengthen immunity and maintain vitality.','wellness','{"consultation": 300, "monthly_therapy": {"min": 1000, "max": 1800}, "wellness_coaching": 500, "follow_up": 200}'::jsonb,true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, condition_type = EXCLUDED.condition_type, pricing = EXCLUDED.pricing, updated_at = NOW();

-- Seed branches (from consolidated schema)
DO $$
DECLARE default_working_hours JSONB := '{"monday": {"open": "08:00", "close": "17:00"},"tuesday": {"open": "08:00", "close": "17:00"},"wednesday": {"open": "08:00", "close": "17:00"},"thursday": {"open": "08:00", "close": "17:00"},"friday": {"open": "08:00", "close": "17:00"},"saturday": {"open": "09:00", "close": "14:00"},"sunday": {"closed": true}}'::jsonb;
BEGIN
  INSERT INTO branches (name, address, phone, email, coordinates, working_hours, image_urls, is_active)
  SELECT 'Nkawkaw Branch','Oframase New Road, Nkawkaw','0246906739','info@dansarpherbal.com',POINT(-0.7667, 6.5500),default_working_hours,'[]'::jsonb,true
  WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name='Nkawkaw Branch');

  INSERT INTO branches (name, address, phone, email, coordinates, working_hours, image_urls, is_active)
  SELECT 'Koforidua Branch','Gyamfikrom-Guabeng, North Koforidua','0246225405','info@dansarpherbal.com',POINT(-0.2667, 6.0833),default_working_hours,'[]'::jsonb,true
  WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name='Koforidua Branch');
END$$;

-- Blog post seed (guarded to avoid missing author_id)
DO $$
DECLARE
  v_author uuid;
BEGIN
  SELECT id INTO v_author FROM users WHERE role IN ('super_admin','admin') ORDER BY created_at ASC LIMIT 1;

  IF v_author IS NULL THEN
    RAISE NOTICE 'Skipping blog seed: no admin/super_admin found.';
    RETURN;
  END IF;

  INSERT INTO blog_posts (title, slug, excerpt, content, author_id, featured_image_url, status, published_at)
  VALUES
    (
      'Introduction to Ghanaian Herbal Medicine',
      'introduction-to-ghanaian-herbal-medicine',
      'Ghana''s rich biodiversity has long supported a vibrant tradition of herbal medicine. This post introduces how plant-based remedies have been used for generations to support health and wellness across the country.',
      $p1$
**A Living Tradition**

Ghana's diverse landscapes—from coastal forests to northern savannas—host thousands of plant species used in traditional healing. Herbal medicine here is not a relic of the past but a living practice that continues to support the wellbeing of countless families. At DanSarp Herbal Centre, we honour this knowledge while offering safe, thoughtful guidance for those who wish to explore it.

[Image: Wide shot of a Ghanaian herbal market with baskets of dried herbs, roots, and barks]

**Herbs in Daily Life**

In many Ghanaian homes, herbs are part of everyday health: teas for digestion, leaves for skin, and roots prepared for specific needs. This tradition is passed down through families and trained practitioners. Understanding the basics helps you make informed choices and appreciate how these plants have earned their place in local wellness practices.

**Working With Your Healthcare Team**

Herbal remedies can complement modern healthcare when used thoughtfully. We encourage you to share any herbs or supplements you use with your doctor, especially if you are on other medicines or managing a health condition. This way, you can enjoy the benefits of Ghana's herbal heritage while staying safe.
$p1$,
      v_author,
      NULL,
      'published',
      '2020-01-15 09:15:00+00'::timestamptz
    ),
    (
      'The History and Tradition of Herbal Healing in Ghana',
      'history-tradition-herbal-healing-ghana',
      'Herbal healing in Ghana spans centuries, with knowledge passed orally and through practice. This article explores the origins and evolution of this tradition and its place in Ghanaian culture today.',
      $p2$
**Roots of a Rich Practice**

Long before formal clinics, communities across Ghana relied on local plants for health. Herbalists—often called *dɔkotera* or *odunsini* in different regions—learned from elders and from careful observation of nature. That knowledge was rarely written down; it lived in memory, in stories, and in the hands of those who prepared remedies for their neighbours.

[Image: Elder herbalist in traditional dress with dried herbs and roots in a woven basket]

**From Generation to Generation**

Apprenticeship has been the main path: young practitioners learn plant identification, preparation, and use from experienced healers. This oral tradition means that respect, secrecy around certain formulae, and the healer's reputation have always mattered. Today, some of this knowledge is being documented to preserve it for future generations while still honouring the role of traditional practitioners.

**Tradition and Change**

Modern Ghana has seen herbal medicine gain official recognition through initiatives like the *Centre for Scientific Research into Plant Medicine*. Traditional and modern approaches increasingly work alongside each other. At DanSarp, we value both the wisdom of the past and the importance of safety, quality, and dialogue with conventional healthcare.
$p2$,
      v_author,
      NULL,
      'published',
      '2020-05-22 14:30:00+00'::timestamptz
    ),
    (
      'Neem (Dogon Yaro): Benefits and Traditional Uses',
      'neem-dogon-yaro-benefits-traditional-uses',
      'Neem, known locally as Dogon Yaro, is a versatile tree whose leaves, bark, and seeds feature in many Ghanaian remedies. Learn about its traditional uses for skin, immunity, and dental care.',
      $p3$
**The multipurpose neem tree**

The neem tree (*Azadirachta indica*) grows in many parts of Ghana and is valued for its bitter leaves, bark, and seeds. In local practice, neem is often used for skin conditions, as a mouthwash, and to support general resilience. Its broad use has made it a staple in many household and herbalist preparations.

[Image: Fresh neem leaves and small twigs in a traditional Ghanaian bowl]

**Skin and topical use**

Neem leaves are commonly crushed or boiled for washes and pastes applied to the skin. Such preparations are traditionally used to soothe irritation and support skin hygiene. If you have sensitive skin or existing conditions, patch-test or seek advice before wider use.

**Dental and mouth care**

A simple neem twig or leaf rinse has long been used to support oral hygiene. The practice continues in many homes. For a gentle mouth rinse, some people steep a small handful of clean neem leaves in hot water, allow it to cool, and use it as a rinse. Always spit it out; do not swallow in large amounts.

**Using neem responsibly**

Neem is potent. Internal use of seeds or concentrated extracts can be harmful and should only be done under expert guidance. For day-to-day support, stick to mild preparations such as diluted leaf teas or topical use, and check with a healthcare provider if you are pregnant, breastfeeding, or on other medicines.
$p3$,
      v_author,
      NULL,
      'published',
      '2020-09-10 11:00:00+00'::timestamptz
    ),
    (
      'Moringa: The Miracle Tree of Ghana',
      'moringa-miracle-tree-ghana',
      'Moringa, with its nutrient-rich leaves and pods, is a cornerstone of Ghanaian herbal and culinary practice. Discover how it is used for energy, nutrition, and wellness in everyday life.',
      $p4$
**A tree of many uses**

Moringa (*Moringa oleifera*) is often called the "miracle tree" for good reason: its leaves, pods, and seeds are packed with vitamins, minerals, and protein. In Ghana, moringa is grown in many backyards and used in soups, sauces, and teas. It has become a go-to for families wanting to add more nutrients to their meals.

[Image: Fresh moringa leaves and green pods on a woven tray]

**Nutrition and energy**

Moringa leaves can be cooked like spinach, added to stews, or dried and powdered for smoothies and teas. The green pods (*drumsticks*) are cooked in soups and valued for their mild, nutritious flesh. Including moringa in a varied diet can help boost intake of iron, calcium, and vitamins—especially useful where balanced meals are harder to get.

**Lactation and postpartum**

In many Ghanaian communities, moringa leaves are given to new mothers to support milk supply and recovery. While traditions vary, the plant's nutritional profile makes it a sensible addition to postpartum meals. If you are breastfeeding, talk to your midwife or doctor before using large amounts or supplements.

**Simple ways to use moringa**

Add fresh leaves to *palava sauce*, *groundnut soup*, or rice dishes. For a quick tea, steep a teaspoon of dried leaf powder in hot water. Start with small amounts and increase gradually. Moringa is generally well tolerated when used as food; if you take concentrated supplements, follow the label and your healthcare provider's advice.
$p4$,
      v_author,
      NULL,
      'published',
      '2021-02-14 16:45:00+00'::timestamptz
    ),
    (
      'Aloe Vera in Ghanaian Traditional Medicine',
      'aloe-vera-ghanaian-traditional-medicine',
      'Aloe vera is a familiar plant in Ghanaian homes, used for skin, burns, and digestion. This post covers traditional uses and how to use it safely, both on the skin and internally.',
      $p5$
**The household healer**

Aloe vera grows easily in Ghana and is kept in many compounds for first aid and skin care. The thick gel inside the leaves is cooling and soothing, which is why it has long been used on minor burns, sunburn, and dry or irritated skin. It is one of the most accessible herbs for everyday use.

[Image: Potted aloe vera plant with a leaf cut open showing clear gel]

**Skin and minor burns**

For small burns or sunburn, a fresh slice of aloe leaf can be applied (gel side to skin) after the area has been cooled with water. The gel is also used for dry skin and minor scrapes. Use only the inner gel; the yellow latex near the rind can be harsh and is not meant for direct application. If a burn is large, blistered, or infected, seek medical care.

**Digestive use: a note of caution**

Aloe has a long history of internal use for digestion, but the latex in the leaf has strong laxative effects and can cause cramping or dependency with regular use. *Aloe vera gel* (the inner, clear part) is generally gentler, but internal use should be occasional and modest. If you have digestive issues, it is better to get a proper diagnosis than to rely on aloe alone.

**Growing and using your own**

Aloe needs little care: well-drained soil, some sun, and sparse watering. When you need it, cut a lower leaf, slice it lengthwise, and scoop out the gel. Store unused gel in the fridge for a few days. For prepared juices or supplements, choose reputable brands and follow the directions—and avoid internal use if you are pregnant or have kidney or digestive conditions unless your doctor approves.
$p5$,
      v_author,
      NULL,
      'published',
      '2021-06-08 08:00:00+00'::timestamptz
    ),
    (
      'Hibiscus (Sobolo/Bissap): Heart Health and More',
      'hibiscus-sobolo-bissap-heart-health',
      'Hibiscus, or sobolo, is the base of a beloved Ghanaian drink rich in antioxidants. Learn how this tart, refreshing plant is used for heart health, hydration, and wellness.',
      $p6$
**The drink of the gods**

Sobolo—made from the calyces of *Hibiscus sabdariffa*—is a tart, deep-red drink enjoyed across Ghana and West Africa. It is served cold, sometimes with ginger or spices, and is not only refreshing but also packed with compounds that support heart and metabolic health. In the heat of the day, a glass of sobolo is both a treat and a traditional tonic.

[Image: Glass of deep-red sobolo drink with dried hibiscus calyces in a small bowl beside it]

**Antioxidants and heart support**

Hibiscus is rich in antioxidants and has been studied for its effects on blood pressure and cholesterol. Drinking sobolo as part of a balanced diet may support healthy circulation. It is not a replacement for prescribed blood-pressure medicine; if you have hypertension, keep taking your medication and discuss sobolo with your doctor, as it can interact with some drugs.

**Making sobolo at home**

Rinse a handful of dried hibiscus calyces, then steep in boiling water for 10–15 minutes. Strain, sweeten lightly if you like (honey or a little sugar), and chill. Add ginger, mint, or cloves for extra flavour. Avoid brewing or storing in reactive metal pots to keep the colour and taste bright.

**Who should take care**

Hibiscus may affect blood pressure and hormone-sensitive conditions. If you are on blood-pressure or diuretic medicines, or if you are pregnant, talk to your healthcare provider before drinking large amounts of sobolo or taking hibiscus supplements.
$p6$,
      v_author,
      NULL,
      'published',
      '2021-11-20 13:22:00+00'::timestamptz
    ),
    (
      'Prekese (Tetrapleura tetraptera): Uses and Benefits',
      'prekese-tetrapleura-tetraptera-uses-benefits',
      'Prekese, the aromatic fruit of the Tetrapleura tetraptera tree, flavours soups and remedies across Ghana. Discover its use in cooking, postpartum care, and traditional wellness.',
      $p7$
**The aromatic pod**

Prekese is the fruit pod of *Tetrapleura tetraptera*, a tree found in Ghana's forests. The dried pods add a distinct, slightly sweet aroma to soups—especially *palm nut* and *Kontomire*—and are also used in herbal preparations. In many homes, the smell of prekese boiling in a pot is a sign of a nourishing, traditional meal.

[Image: Dried prekese pods on a wooden surface next to a mortar and pestle]

**In the kitchen**

A piece of prekese pod is typically added to soups—such as *palm nut* and *Kontomire*—and allowed to simmer; it is removed before serving. It contributes depth and a subtle sweetness. The seeds inside can be ground and used in small amounts. If you are new to prekese, start with a small piece and increase to taste.

**Postpartum and circulation**

In Ghanaian tradition, prekese is often included in soups and preparations for new mothers, to support recovery and milk supply. It is also used in remedies aimed at supporting circulation and general strength. These uses are based on long experience; if you are postpartum or have health concerns, it helps to combine tradition with guidance from your midwife or doctor.

**Using prekese safely**

Prekese is generally used in culinary amounts. For medicinal preparations, use only under the guidance of someone experienced. If you have diabetes or are on blood-sugar or blood-pressure medicines, discuss prekese use with your healthcare provider, as it may interact with some treatments.
$p7$,
      v_author,
      NULL,
      'published',
      '2022-03-05 10:30:00+00'::timestamptz
    ),
    (
      'Dawadawa and Gut Health: A Ghanaian Perspective',
      'dawadawa-gut-health-ghanaian-perspective',
      'Dawadawa (iru/locust bean) is a fermented seasoning central to West African cooking. Explore its flavour, benefits for gut health, and how to use it in soups and stews.',
      $p8$
**A flavour cornerstone**

Dawadawa is made from fermented African locust beans (*Parkia biglobosa*). Its deep umami flavour forms the base of many soups and stews across Ghana and West Africa, such as *Ayoyo* and *Tuo Zaafi*. The smell of fresh dawadawa in the market is instantly recognisable and signals a pot of something hearty on the way.

[Image: Fermented locust beans (dawadawa) in a small calabash with a wooden spoon]

**Fermentation and the gut**

As a fermented food, dawadawa contributes beneficial compounds that can support the gut microbiome. Enjoyed as part of traditional dishes, it can complement a diet rich in fibre and vegetables. While research is ongoing, many cooks value it for both flavour and digestive support.

**Using dawadawa in your cooking**

Add a small piece (or a pinch if powdered) of dawadawa near the start of cooking your soup or stew, allowing it to dissolve and meld with the other flavours. Because it is strong, start with less and add more as you get used to it. It pairs well with greens, tomatoes, and fish.

**Who should take care**

If you are new to dawadawa or have food sensitivities, introduce it gradually. Store it properly to avoid spoilage, and buy from trusted sources. For people on low-sodium diets, keep total salt in mind, as dawadawa can be salty depending on the producer.
$p8$,
      v_author,
      NULL,
      'published',
      '2022-07-18 07:50:00+00'::timestamptz
    ),
    (
      'Tiger Nuts (Atadwe): Energy and Digestive Support',
      'tiger-nuts-atadwe-energy-digestive-support',
      'Tiger nuts, or atadwe, are enjoyed as a snack and in drinks like Kunu Aya. Learn how they''re used for energy, digestion, and traditional wellness in Ghana.',
      $p9$
**Tiny tubers, big uses**

Tiger nuts (*Cyperus esculentus*) are chewy, sweet tubers sold fresh or dried in markets across Ghana. You'll find them in snacks, milky drinks like *Kunu Aya*, and even ground into flour. They provide fibre, healthy fats, and a pleasant, nutty taste.

[Image: Bowl of tiger nuts with a glass of tiger-nut milk beside it]

**Energy and digestion**

Because they are rich in fibre and resistant starch, tiger nuts can help support regular digestion. They also offer a steady source of energy. In traditional practice, they're sometimes used to make drinks for stamina and to soothe the stomach.

**How to enjoy them**

Soak dried tiger nuts to soften, then eat them as a snack, blend into a drink, or add to porridges. Start with small amounts if you are not used to a lot of fibre. If you have nut allergies, tiger nuts are botanically tubers, but introduce cautiously if unsure.

**Who should take care**

Tiger nuts are generally safe in food amounts. If you have digestive conditions, increase slowly and drink water to help with fibre. Store dried nuts well to avoid spoilage or insects.
$p9$,
      v_author,
      NULL,
      'published',
      '2022-10-02 15:10:00+00'::timestamptz
    ),
    (
      'Soursop (Aluguntugui): Cooling Fruit with a Tradition',
      'soursop-aluguntugui-cooling-fruit-tradition',
      'Soursop, or aluguntugui, is loved for its tangy-sweet flavour and cooling pulp. Explore how this fruit is enjoyed and its place in Ghanaian kitchens and home remedies.',
      $p10$
**Taste and texture**

Soursop (*Annona muricata*) has a soft, fragrant white pulp with a tangy sweetness. In Ghana, it's eaten fresh, blended into juices, or made into ice creams and sorbets. The fruit is a treat in the heat, offering both hydration and flavour.

[Image: Fresh soursop fruit cut open to show white pulp and black seeds]

**Traditional uses**

Beyond the kitchen, soursop leaves and pulp have been used in some home remedies for relaxation and cooling. Scientific evidence is limited, so enjoy soursop primarily as a delicious fruit and discuss any medicinal use with your healthcare provider.

**How to enjoy**

Chill the fruit, scoop out the pulp (removing seeds), and blend with a bit of water or milk for a smoothie. Add lime or ginger for extra brightness. The ripe fruit bruises easily, so handle gently and refrigerate once ripe.

**Who should take care**

Some plant parts contain alkaloids; avoid consuming seeds and unripe parts in large amounts. If pregnant or managing health conditions, stick to food uses and consult your doctor before using leaves or concentrates.
$p10$,
      v_author,
      NULL,
      'published',
      '2023-01-12 11:05:00+00'::timestamptz
    )
  ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    featured_image_url = EXCLUDED.featured_image_url,
    status = EXCLUDED.status,
    published_at = EXCLUDED.published_at,
    author_id = EXCLUDED.author_id,
    updated_at = NOW();
END$$;
