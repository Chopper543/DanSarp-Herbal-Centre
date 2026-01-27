-- ============================================================================
-- PRESCRIPTIONS TABLE
-- ============================================================================
-- Digital prescription management for herbal medicine clinic
-- Supports herb/formula prescriptions with dosage, instructions, and refills
-- ============================================================================

-- Prescription status enum
CREATE TYPE prescription_status AS ENUM (
  'draft',
  'active',
  'completed',
  'cancelled',
  'expired'
);

-- Prescriptions table
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Prescription details
  herbs_formulas JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {name, quantity, unit, dosage, instructions}
  instructions TEXT,
  duration_days INTEGER,
  refills_remaining INTEGER DEFAULT 0,
  refills_original INTEGER DEFAULT 0,
  
  -- Dates
  prescribed_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date DATE,
  start_date DATE,
  end_date DATE,
  
  -- Status
  status prescription_status DEFAULT 'draft',
  
  -- Notes
  doctor_notes TEXT,
  patient_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_appointment_id ON prescriptions(appointment_id);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);
CREATE INDEX idx_prescriptions_prescribed_date ON prescriptions(prescribed_date);
CREATE INDEX idx_prescriptions_expiry_date ON prescriptions(expiry_date);

-- Prescription refill requests table
CREATE TABLE prescription_refills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Refill details
  requested_date TIMESTAMPTZ DEFAULT NOW(),
  requested_refills INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  
  -- Admin response
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for refills
CREATE INDEX idx_refills_prescription_id ON prescription_refills(prescription_id);
CREATE INDEX idx_refills_patient_id ON prescription_refills(patient_id);
CREATE INDEX idx_refills_status ON prescription_refills(status);

-- Update trigger for prescriptions
CREATE OR REPLACE FUNCTION update_prescriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prescriptions_updated_at
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_prescriptions_updated_at();

-- Update trigger for prescription_refills
CREATE OR REPLACE FUNCTION update_prescription_refills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prescription_refills_updated_at
  BEFORE UPDATE ON prescription_refills
  FOR EACH ROW
  EXECUTE FUNCTION update_prescription_refills_updated_at();

-- RLS Policies for prescriptions
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- Patients can view their own prescriptions
CREATE POLICY "Patients can view own prescriptions"
  ON prescriptions FOR SELECT
  USING (auth.uid() = patient_id);

-- Doctors can view prescriptions they created
CREATE POLICY "Doctors can view their prescriptions"
  ON prescriptions FOR SELECT
  USING (
    auth.uid() = doctor_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager')
    )
  );

-- Doctors and admins can insert prescriptions
CREATE POLICY "Doctors and admins can create prescriptions"
  ON prescriptions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.id = doctor_id OR users.role IN ('admin', 'super_admin', 'appointment_manager'))
    )
  );

-- Doctors and admins can update prescriptions
CREATE POLICY "Doctors and admins can update prescriptions"
  ON prescriptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.id = doctor_id OR users.role IN ('admin', 'super_admin', 'appointment_manager'))
    )
  );

-- RLS Policies for prescription_refills
ALTER TABLE prescription_refills ENABLE ROW LEVEL SECURITY;

-- Patients can view and create their own refill requests
CREATE POLICY "Patients can manage own refill requests"
  ON prescription_refills FOR ALL
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

-- Admins can view and manage all refill requests
CREATE POLICY "Admins can manage all refill requests"
  ON prescription_refills FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager')
    )
  );
