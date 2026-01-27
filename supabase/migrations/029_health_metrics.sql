-- ============================================================================
-- HEALTH METRICS TABLE
-- ============================================================================
-- Patient health data tracking (vitals, symptoms, etc.)
-- ============================================================================

-- Health metrics table
CREATE TABLE health_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Metric details
  metric_type TEXT NOT NULL, -- e.g., 'blood_pressure', 'weight', 'temperature', 'symptom'
  metric_name TEXT NOT NULL,
  value NUMERIC,
  unit TEXT, -- e.g., 'mmHg', 'kg', '°C'
  value_text TEXT, -- For non-numeric values (e.g., symptom descriptions)
  
  -- Additional data
  notes TEXT,
  metadata JSONB, -- Additional structured data (e.g., {systolic: 120, diastolic: 80})
  
  -- Date/time
  recorded_date DATE NOT NULL,
  recorded_time TIME,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_health_metrics_patient_id ON health_metrics(patient_id);
CREATE INDEX idx_health_metrics_metric_type ON health_metrics(metric_type);
CREATE INDEX idx_health_metrics_recorded_date ON health_metrics(recorded_date);
CREATE INDEX idx_health_metrics_recorded_at ON health_metrics(recorded_at);

-- Update trigger
CREATE OR REPLACE FUNCTION update_health_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER health_metrics_updated_at
  BEFORE UPDATE ON health_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_health_metrics_updated_at();

-- RLS Policies
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;

-- Patients can view and create their own health metrics
CREATE POLICY "Patients can manage own health metrics"
  ON health_metrics FOR ALL
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

-- Doctors and admins can view all health metrics
CREATE POLICY "Doctors and admins can view health metrics"
  ON health_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager')
    )
  );
