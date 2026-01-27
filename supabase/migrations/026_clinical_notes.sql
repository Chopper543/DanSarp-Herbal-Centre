-- ============================================================================
-- CLINICAL NOTES TABLE (SOAP Notes)
-- ============================================================================
-- Structured clinical documentation using SOAP format
-- Supports templates, vital signs, and full-text search
-- ============================================================================

-- Clinical note type enum
CREATE TYPE clinical_note_type AS ENUM (
  'soap',
  'progress',
  'general'
);

-- Clinical notes table
CREATE TABLE clinical_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Note type
  note_type clinical_note_type DEFAULT 'soap',
  
  -- SOAP structure
  subjective TEXT, -- Patient's description of symptoms
  objective TEXT, -- Observable findings, vital signs, exam results
  assessment TEXT, -- Clinical assessment, diagnosis
  plan TEXT, -- Treatment plan, next steps
  
  -- Structured data
  vital_signs JSONB DEFAULT '{}'::jsonb, -- {bp, pulse, temp, weight, height, etc.}
  diagnosis_codes TEXT[] DEFAULT '{}', -- Array of diagnosis codes (ICD-10, etc.)
  
  -- Template support
  template_id UUID, -- Reference to template if created from one
  is_template BOOLEAN DEFAULT FALSE, -- Whether this note is a template
  
  -- Attachments
  attachments TEXT[] DEFAULT '{}', -- Array of file URLs from Supabase Storage
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_clinical_notes_patient_id ON clinical_notes(patient_id);
CREATE INDEX idx_clinical_notes_doctor_id ON clinical_notes(doctor_id);
CREATE INDEX idx_clinical_notes_appointment_id ON clinical_notes(appointment_id);
CREATE INDEX idx_clinical_notes_note_type ON clinical_notes(note_type);
CREATE INDEX idx_clinical_notes_created_at ON clinical_notes(created_at);
CREATE INDEX idx_clinical_notes_template_id ON clinical_notes(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX idx_clinical_notes_is_template ON clinical_notes(is_template) WHERE is_template = TRUE;

-- Full-text search index on all text fields
CREATE INDEX idx_clinical_notes_fulltext_search ON clinical_notes 
  USING gin(
    to_tsvector('english', 
      COALESCE(subjective, '') || ' ' ||
      COALESCE(objective, '') || ' ' ||
      COALESCE(assessment, '') || ' ' ||
      COALESCE(plan, '')
    )
  );

-- Update trigger
CREATE OR REPLACE FUNCTION update_clinical_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clinical_notes_updated_at
  BEFORE UPDATE ON clinical_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_clinical_notes_updated_at();

-- RLS Policies
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;

-- Patients can view their own clinical notes
CREATE POLICY "Patients can view own clinical notes"
  ON clinical_notes FOR SELECT
  USING (auth.uid() = patient_id);

-- Doctors and admins can view all clinical notes
CREATE POLICY "Doctors can view clinical notes"
  ON clinical_notes FOR SELECT
  USING (
    auth.uid() = doctor_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager')
    )
  );

-- Doctors and admins can create clinical notes
CREATE POLICY "Doctors and admins can create clinical notes"
  ON clinical_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.id = doctor_id OR users.role IN ('admin', 'super_admin', 'appointment_manager'))
    )
  );

-- Doctors and admins can update clinical notes
CREATE POLICY "Doctors and admins can update clinical notes"
  ON clinical_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.id = doctor_id OR users.role IN ('admin', 'super_admin', 'appointment_manager'))
    )
  );

-- Only admins can delete clinical notes
CREATE POLICY "Admins can delete clinical notes"
  ON clinical_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );
