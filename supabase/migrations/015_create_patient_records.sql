-- Migration: Create patient_records table for comprehensive patient information
-- This table stores detailed patient demographics, medical history, and contact information

-- Create enum types for patient records
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE marital_status_type AS ENUM ('single', 'married', 'divorced', 'widowed', 'separated');

-- Patient Records table
CREATE TABLE patient_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Demographics
  date_of_birth DATE,
  age INTEGER, -- Can be calculated from date_of_birth, but stored for quick access
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
  emergency_contact_relationship TEXT, -- e.g., "Spouse", "Parent", "Sibling"
  
  -- Medical Information
  primary_condition TEXT, -- Main medical condition
  condition_started_date DATE, -- When the condition started
  medical_history JSONB DEFAULT '[]'::jsonb, -- Array of past conditions/treatments
  allergies TEXT[], -- Array of known allergies
  current_medications TEXT[], -- Array of current medications
  blood_type TEXT, -- e.g., "A+", "B-", "O+", "AB+"
  
  -- Visit Tracking
  first_visit_date TIMESTAMPTZ, -- First visit to the clinic
  last_visit_date TIMESTAMPTZ, -- Most recent visit
  total_visits INTEGER DEFAULT 0, -- Count of total visits
  
  -- Doctor's Reports/Notes
  doctor_notes JSONB DEFAULT '[]'::jsonb, -- Array of doctor's reports/notes
  -- Format: [{"date": "2024-01-15", "doctor": "Dr. Smith", "report": "Patient shows improvement...", "attachments": ["url1", "url2"]}]
  
  -- Additional Information
  insurance_provider TEXT,
  insurance_number TEXT,
  referral_source TEXT, -- How they heard about the clinic
  preferred_language TEXT DEFAULT 'en',
  notes TEXT, -- General notes
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin who created the record
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL -- Admin who last updated
);

-- Create indexes for efficient queries
CREATE INDEX idx_patient_records_user_id ON patient_records(user_id);
CREATE INDEX idx_patient_records_condition ON patient_records(primary_condition);
CREATE INDEX idx_patient_records_last_visit ON patient_records(last_visit_date DESC);
CREATE INDEX idx_patient_records_first_visit ON patient_records(first_visit_date);

-- Add updated_at trigger
CREATE TRIGGER update_patient_records_updated_at 
  BEFORE UPDATE ON patient_records
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update age from date_of_birth
CREATE OR REPLACE FUNCTION update_patient_age()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN
    NEW.age = EXTRACT(YEAR FROM AGE(NEW.date_of_birth));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patient_age_trigger
  BEFORE INSERT OR UPDATE ON patient_records
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_age();

-- Function to update last_visit_date when appointment is completed
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

CREATE TRIGGER update_patient_visit_tracking
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_last_visit();

-- Enable Row Level Security
ALTER TABLE patient_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Patients can view their own records
CREATE POLICY "Patients can view their own records"
  ON patient_records FOR SELECT
  USING (auth.uid() = user_id);

-- Patients can update their own basic information
-- Note: Medical fields (primary_condition, condition_started_date, medical_history, doctor_notes)
-- should be restricted at the application level, as RLS policies cannot compare OLD and NEW values
CREATE POLICY "Patients can update their own basic info"
  ON patient_records FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all patient records
CREATE POLICY "Admins can view all patient records"
  ON patient_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'appointment_manager')
    )
  );

-- Admins can insert patient records
CREATE POLICY "Admins can insert patient records"
  ON patient_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'appointment_manager')
    )
  );

-- Admins can update all patient records
CREATE POLICY "Admins can update all patient records"
  ON patient_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'appointment_manager')
    )
  );

-- Admins can delete patient records
CREATE POLICY "Admins can delete patient records"
  ON patient_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- Add comment for documentation
COMMENT ON TABLE patient_records IS 'Comprehensive patient medical records including demographics, medical history, and visit tracking';
COMMENT ON COLUMN patient_records.doctor_notes IS 'JSONB array of doctor reports: [{"date": "ISO date", "doctor": "name", "report": "text", "attachments": ["urls"]}]';
COMMENT ON COLUMN patient_records.medical_history IS 'JSONB array of past conditions: [{"condition": "name", "started": "date", "ended": "date", "notes": "text"}]';
