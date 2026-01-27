-- ============================================================================
-- TREATMENT PLANS TABLE
-- ============================================================================
-- Structured treatment plan management with follow-up scheduling
-- ============================================================================

-- Treatment plan status enum
CREATE TYPE treatment_plan_status AS ENUM (
  'draft',
  'active',
  'completed',
  'cancelled',
  'on_hold'
);

-- Treatment plans table
CREATE TABLE treatment_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Treatment plan details
  title TEXT NOT NULL,
  description TEXT,
  diagnosis TEXT,
  goals TEXT[], -- Array of treatment goals
  treatment_approach TEXT,
  
  -- Duration
  start_date DATE NOT NULL,
  end_date DATE,
  estimated_duration_days INTEGER,
  
  -- Status
  status treatment_plan_status DEFAULT 'draft',
  
  -- Progress tracking
  progress_notes JSONB DEFAULT '[]'::jsonb, -- Array of {date, note, progress_percentage}
  current_progress INTEGER DEFAULT 0 CHECK (current_progress >= 0 AND current_progress <= 100),
  
  -- Follow-ups
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_interval_days INTEGER, -- Days between follow-ups
  next_follow_up_date DATE,
  
  -- Template reference (optional)
  template_id UUID, -- For future template system
  
  -- Notes
  doctor_notes TEXT,
  patient_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Follow-up appointments table (linked to treatment plans)
CREATE TABLE treatment_plan_followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  treatment_plan_id UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Follow-up details
  scheduled_date TIMESTAMPTZ NOT NULL,
  follow_up_type TEXT, -- e.g., 'review', 'progress_check', 'adjustment'
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'missed')),
  
  -- Notes
  notes TEXT,
  outcome TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_treatment_plans_patient_id ON treatment_plans(patient_id);
CREATE INDEX idx_treatment_plans_doctor_id ON treatment_plans(doctor_id);
CREATE INDEX idx_treatment_plans_appointment_id ON treatment_plans(appointment_id);
CREATE INDEX idx_treatment_plans_status ON treatment_plans(status);
CREATE INDEX idx_treatment_plans_start_date ON treatment_plans(start_date);
CREATE INDEX idx_treatment_plans_next_follow_up ON treatment_plans(next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;

CREATE INDEX idx_followups_treatment_plan_id ON treatment_plan_followups(treatment_plan_id);
CREATE INDEX idx_followups_appointment_id ON treatment_plan_followups(appointment_id);
CREATE INDEX idx_followups_scheduled_date ON treatment_plan_followups(scheduled_date);
CREATE INDEX idx_followups_status ON treatment_plan_followups(status);

-- Update triggers
CREATE OR REPLACE FUNCTION update_treatment_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER treatment_plans_updated_at
  BEFORE UPDATE ON treatment_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_treatment_plans_updated_at();

CREATE TRIGGER treatment_plan_followups_updated_at
  BEFORE UPDATE ON treatment_plan_followups
  FOR EACH ROW
  EXECUTE FUNCTION update_treatment_plans_updated_at();

-- RLS Policies
ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;

-- Patients can view their own treatment plans
CREATE POLICY "Patients can view own treatment plans"
  ON treatment_plans FOR SELECT
  USING (auth.uid() = patient_id);

-- Doctors and admins can view all treatment plans
CREATE POLICY "Doctors can view treatment plans"
  ON treatment_plans FOR SELECT
  USING (
    auth.uid() = doctor_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager')
    )
  );

-- Doctors and admins can create treatment plans
CREATE POLICY "Doctors and admins can create treatment plans"
  ON treatment_plans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.id = doctor_id OR users.role IN ('admin', 'super_admin', 'appointment_manager'))
    )
  );

-- Doctors and admins can update treatment plans
CREATE POLICY "Doctors and admins can update treatment plans"
  ON treatment_plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.id = doctor_id OR users.role IN ('admin', 'super_admin', 'appointment_manager'))
    )
  );

-- RLS for follow-ups
ALTER TABLE treatment_plan_followups ENABLE ROW LEVEL SECURITY;

-- Patients can view follow-ups for their treatment plans
CREATE POLICY "Patients can view own follow-ups"
  ON treatment_plan_followups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM treatment_plans
      WHERE treatment_plans.id = treatment_plan_followups.treatment_plan_id
      AND treatment_plans.patient_id = auth.uid()
    )
  );

-- Doctors and admins can manage all follow-ups
CREATE POLICY "Doctors and admins can manage follow-ups"
  ON treatment_plan_followups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        EXISTS (
          SELECT 1 FROM treatment_plans
          WHERE treatment_plans.id = treatment_plan_followups.treatment_plan_id
          AND treatment_plans.doctor_id = users.id
        )
        OR users.role IN ('admin', 'super_admin', 'appointment_manager')
      )
    )
  );
