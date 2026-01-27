-- ============================================================================
-- LAB RESULTS TABLE
-- ============================================================================
-- Lab and test results management for patient records
-- Supports structured results, file attachments, and status tracking
-- ============================================================================

-- Lab result status enum
CREATE TYPE lab_result_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'reviewed'
);

-- Lab results table
CREATE TABLE lab_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Test information
  test_name TEXT NOT NULL,
  test_type TEXT, -- e.g., 'blood', 'urine', 'imaging', 'other'
  ordered_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_date DATE,
  
  -- Results data
  results JSONB DEFAULT '{}'::jsonb, -- Structured key-value pairs for test results
  normal_range TEXT, -- Normal range description
  units TEXT, -- Units of measurement (e.g., 'mg/dL', 'mmol/L')
  
  -- Files and attachments
  file_urls TEXT[] DEFAULT '{}', -- Array of file URLs from Supabase Storage
  
  -- Status
  status lab_result_status DEFAULT 'pending',
  
  -- Notes
  notes TEXT,
  doctor_notes TEXT, -- Internal notes for doctors
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_lab_results_patient_id ON lab_results(patient_id);
CREATE INDEX idx_lab_results_doctor_id ON lab_results(doctor_id);
CREATE INDEX idx_lab_results_appointment_id ON lab_results(appointment_id);
CREATE INDEX idx_lab_results_status ON lab_results(status);
CREATE INDEX idx_lab_results_ordered_date ON lab_results(ordered_date);
CREATE INDEX idx_lab_results_completed_date ON lab_results(completed_date);
CREATE INDEX idx_lab_results_test_type ON lab_results(test_type);

-- Full-text search index on test_name
CREATE INDEX idx_lab_results_test_name_search ON lab_results USING gin(to_tsvector('english', test_name));

-- Update trigger
CREATE OR REPLACE FUNCTION update_lab_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lab_results_updated_at
  BEFORE UPDATE ON lab_results
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_results_updated_at();

-- RLS Policies
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

-- Patients can view their own lab results
CREATE POLICY "Patients can view own lab results"
  ON lab_results FOR SELECT
  USING (auth.uid() = patient_id);

-- Doctors and admins can view all lab results
CREATE POLICY "Doctors can view lab results"
  ON lab_results FOR SELECT
  USING (
    auth.uid() = doctor_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager')
    )
  );

-- Doctors and admins can create lab results
CREATE POLICY "Doctors and admins can create lab results"
  ON lab_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.id = doctor_id OR users.role IN ('admin', 'super_admin', 'appointment_manager'))
    )
  );

-- Doctors and admins can update lab results
CREATE POLICY "Doctors and admins can update lab results"
  ON lab_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.id = doctor_id OR users.role IN ('admin', 'super_admin', 'appointment_manager'))
    )
  );

-- Only admins can delete lab results (soft delete via status)
CREATE POLICY "Admins can delete lab results"
  ON lab_results FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );
