-- ============================================================================
-- INTAKE FORMS TABLES
-- ============================================================================
-- Digital intake form templates and patient responses
-- Supports dynamic form schemas and response tracking
-- ============================================================================

-- Intake form response status enum
CREATE TYPE intake_form_response_status AS ENUM (
  'draft',
  'submitted',
  'reviewed',
  'approved',
  'rejected'
);

-- Intake forms table (templates)
CREATE TABLE intake_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Form details
  name TEXT NOT NULL,
  description TEXT,
  form_schema JSONB NOT NULL DEFAULT '{}'::jsonb, -- Dynamic form schema with fields, validation, etc.
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Intake form responses table
CREATE TABLE intake_form_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES intake_forms(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Response data
  response_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Patient's responses to form fields
  
  -- Status
  status intake_form_response_status DEFAULT 'draft',
  
  -- Review workflow
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for intake_forms
CREATE INDEX idx_intake_forms_is_active ON intake_forms(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_intake_forms_created_by ON intake_forms(created_by);
CREATE INDEX idx_intake_forms_created_at ON intake_forms(created_at);

-- Indexes for intake_form_responses
CREATE INDEX idx_intake_form_responses_form_id ON intake_form_responses(form_id);
CREATE INDEX idx_intake_form_responses_patient_id ON intake_form_responses(patient_id);
CREATE INDEX idx_intake_form_responses_appointment_id ON intake_form_responses(appointment_id);
CREATE INDEX idx_intake_form_responses_status ON intake_form_responses(status);
CREATE INDEX idx_intake_form_responses_submitted_at ON intake_form_responses(submitted_at);
CREATE INDEX idx_intake_form_responses_reviewed_by ON intake_form_responses(reviewed_by);

-- Full-text search on form name
CREATE INDEX idx_intake_forms_name_search ON intake_forms USING gin(to_tsvector('english', name));

-- Update triggers
CREATE OR REPLACE FUNCTION update_intake_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER intake_forms_updated_at
  BEFORE UPDATE ON intake_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_intake_forms_updated_at();

CREATE TRIGGER intake_form_responses_updated_at
  BEFORE UPDATE ON intake_form_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_intake_forms_updated_at();

-- RLS Policies for intake_forms
ALTER TABLE intake_forms ENABLE ROW LEVEL SECURITY;

-- Everyone can view active intake forms
CREATE POLICY "Everyone can view active intake forms"
  ON intake_forms FOR SELECT
  USING (is_active = TRUE OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'content_manager')
  ));

-- Only admins and content managers can create intake forms
CREATE POLICY "Admins can create intake forms"
  ON intake_forms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'content_manager')
    )
  );

-- Only admins and content managers can update intake forms
CREATE POLICY "Admins can update intake forms"
  ON intake_forms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'content_manager')
    )
  );

-- Only admins can delete intake forms
CREATE POLICY "Admins can delete intake forms"
  ON intake_forms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for intake_form_responses
ALTER TABLE intake_form_responses ENABLE ROW LEVEL SECURITY;

-- Patients can view their own responses
CREATE POLICY "Patients can view own responses"
  ON intake_form_responses FOR SELECT
  USING (auth.uid() = patient_id);

-- Doctors and admins can view all responses
CREATE POLICY "Doctors can view all responses"
  ON intake_form_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'content_manager')
    )
  );

-- Patients can create and update their own draft responses
CREATE POLICY "Patients can manage own draft responses"
  ON intake_form_responses FOR ALL
  USING (
    auth.uid() = patient_id AND
    (status = 'draft' OR status IS NULL)
  )
  WITH CHECK (
    auth.uid() = patient_id AND
    (status = 'draft' OR status IS NULL)
  );

-- Patients can submit their responses
CREATE POLICY "Patients can submit responses"
  ON intake_form_responses FOR UPDATE
  USING (auth.uid() = patient_id)
  WITH CHECK (
    auth.uid() = patient_id AND
    status = 'submitted'
  );

-- Doctors and admins can review responses
CREATE POLICY "Doctors and admins can review responses"
  ON intake_form_responses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager')
    )
  );
