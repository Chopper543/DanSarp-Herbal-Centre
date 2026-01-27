-- ============================================================================
-- APPOINTMENT WAITLIST TABLE
-- ============================================================================
-- Waitlist for fully booked appointment slots
-- ============================================================================

-- Appointment waitlist table
CREATE TABLE appointment_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  
  -- Preferred appointment details
  preferred_date DATE,
  preferred_time TIME,
  treatment_type TEXT,
  
  -- Priority
  priority INTEGER DEFAULT 0, -- Higher number = higher priority
  notes TEXT,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'notified', 'booked', 'cancelled')),
  notified_at TIMESTAMPTZ,
  booked_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_waitlist_patient_id ON appointment_waitlist(patient_id);
CREATE INDEX idx_waitlist_branch_id ON appointment_waitlist(branch_id);
CREATE INDEX idx_waitlist_status ON appointment_waitlist(status);
CREATE INDEX idx_waitlist_preferred_date ON appointment_waitlist(preferred_date);
CREATE INDEX idx_waitlist_priority ON appointment_waitlist(priority DESC);

-- Update trigger
CREATE OR REPLACE FUNCTION update_waitlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER waitlist_updated_at
  BEFORE UPDATE ON appointment_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_waitlist_updated_at();

-- RLS Policies
ALTER TABLE appointment_waitlist ENABLE ROW LEVEL SECURITY;

-- Patients can view and create their own waitlist entries
CREATE POLICY "Patients can manage own waitlist"
  ON appointment_waitlist FOR ALL
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

-- Admins can view and manage all waitlist entries
CREATE POLICY "Admins can manage all waitlist"
  ON appointment_waitlist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager')
    )
  );
