-- ============================================================================
-- DOCTOR AVAILABILITY TABLE
-- ============================================================================
-- Doctor-specific availability slots and time-off management
-- ============================================================================

-- Availability type enum
CREATE TYPE availability_type AS ENUM (
  'working_hours',
  'time_off',
  'holiday',
  'emergency'
);

-- Doctor availability table
CREATE TABLE doctor_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Availability details
  type availability_type DEFAULT 'working_hours',
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME, -- For recurring weekly schedules
  end_time TIME,
  
  -- Specific date ranges (for time-off, holidays)
  start_date DATE,
  end_date DATE,
  start_datetime TIMESTAMPTZ, -- For specific time slots
  end_datetime TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  reason TEXT, -- For time-off
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_doctor_availability_doctor_id ON doctor_availability(doctor_id);
CREATE INDEX idx_doctor_availability_type ON doctor_availability(type);
CREATE INDEX idx_doctor_availability_day_of_week ON doctor_availability(day_of_week);
CREATE INDEX idx_doctor_availability_start_date ON doctor_availability(start_date);
CREATE INDEX idx_doctor_availability_start_datetime ON doctor_availability(start_datetime);
CREATE INDEX idx_doctor_availability_is_active ON doctor_availability(is_active) WHERE is_active = TRUE;

-- Update trigger
CREATE OR REPLACE FUNCTION update_doctor_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER doctor_availability_updated_at
  BEFORE UPDATE ON doctor_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_doctor_availability_updated_at();

-- RLS Policies
ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;

-- Doctors can view their own availability
CREATE POLICY "Doctors can view own availability"
  ON doctor_availability FOR SELECT
  USING (auth.uid() = doctor_id);

-- Admins can view all availability
CREATE POLICY "Admins can view all availability"
  ON doctor_availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager')
    )
  );

-- Doctors and admins can manage availability
CREATE POLICY "Doctors and admins can manage availability"
  ON doctor_availability FOR ALL
  USING (
    auth.uid() = doctor_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager')
    )
  );
