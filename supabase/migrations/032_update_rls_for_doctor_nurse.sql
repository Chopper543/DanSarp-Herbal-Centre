-- ============================================================================
-- UPDATE RLS FOR DOCTOR & NURSE ROLES (FORWARD-ONLY)
-- ============================================================================
-- Extends existing RLS policies to recognize the new `doctor` and `nurse` roles.
-- Nurse permissions: clinical assistant (lab results create/update + intake response review).
-- ============================================================================

-- ============================================================================
-- LAB RESULTS: allow doctor+nurse to access/manage (in addition to existing staff roles)
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can view lab results" ON lab_results;
CREATE POLICY "Doctors can view lab results"
  ON lab_results FOR SELECT
  USING (
    auth.uid() = doctor_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
    )
  );

DROP POLICY IF EXISTS "Doctors and admins can create lab results" ON lab_results;
CREATE POLICY "Doctors and admins can create lab results"
  ON lab_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
        OR users.id = doctor_id
      )
    )
  );

DROP POLICY IF EXISTS "Doctors and admins can update lab results" ON lab_results;
CREATE POLICY "Doctors and admins can update lab results"
  ON lab_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
        OR users.id = doctor_id
      )
    )
  );

-- ============================================================================
-- CLINICAL NOTES: doctor/admin/appointment_manager can create/update; nurse read-only
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can view clinical notes" ON clinical_notes;
CREATE POLICY "Doctors can view clinical notes"
  ON clinical_notes FOR SELECT
  USING (
    auth.uid() = doctor_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
    )
  );

DROP POLICY IF EXISTS "Doctors and admins can create clinical notes" ON clinical_notes;
CREATE POLICY "Doctors and admins can create clinical notes"
  ON clinical_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor')
        OR users.id = doctor_id
      )
    )
  );

DROP POLICY IF EXISTS "Doctors and admins can update clinical notes" ON clinical_notes;
CREATE POLICY "Doctors and admins can update clinical notes"
  ON clinical_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor')
        OR users.id = doctor_id
      )
    )
  );

-- ============================================================================
-- INTAKE FORM RESPONSES: allow doctor+nurse to view/review responses
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can view all responses" ON intake_form_responses;
CREATE POLICY "Doctors can view all responses"
  ON intake_form_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'content_manager', 'doctor', 'nurse')
    )
  );

DROP POLICY IF EXISTS "Doctors and admins can review responses" ON intake_form_responses;
CREATE POLICY "Doctors and admins can review responses"
  ON intake_form_responses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
    )
  );

-- ============================================================================
-- STORAGE POLICIES: update to include doctor+nurse; fix matching for stored URLs
-- ============================================================================
-- Note: app code stores public URLs in lab_results.file_urls and clinical_notes.attachments.
-- We therefore match storage.objects.name as a substring of those URL fields.

-- Lab results
DROP POLICY IF EXISTS "Patients can view own lab result files" ON storage.objects;
CREATE POLICY "Patients can view own lab result files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lab-results' AND
  EXISTS (
    SELECT 1 FROM lab_results
    WHERE lab_results.patient_id = auth.uid()
    AND lab_results.file_urls::text LIKE '%' || storage.objects.name || '%'
  )
);

DROP POLICY IF EXISTS "Doctors can view lab result files" ON storage.objects;
CREATE POLICY "Doctors can view lab result files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lab-results' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
  )
);

DROP POLICY IF EXISTS "Doctors can upload lab result files" ON storage.objects;
CREATE POLICY "Doctors can upload lab result files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lab-results' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
  )
);

DROP POLICY IF EXISTS "Doctors can delete lab result files" ON storage.objects;
CREATE POLICY "Doctors can delete lab result files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lab-results' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
  )
);

-- Clinical notes
DROP POLICY IF EXISTS "Patients can view own clinical note files" ON storage.objects;
CREATE POLICY "Patients can view own clinical note files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'clinical-notes' AND
  EXISTS (
    SELECT 1 FROM clinical_notes
    WHERE clinical_notes.patient_id = auth.uid()
    AND clinical_notes.attachments::text LIKE '%' || storage.objects.name || '%'
  )
);

DROP POLICY IF EXISTS "Doctors can view clinical note files" ON storage.objects;
CREATE POLICY "Doctors can view clinical note files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'clinical-notes' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
  )
);

DROP POLICY IF EXISTS "Doctors can upload clinical note files" ON storage.objects;
CREATE POLICY "Doctors can upload clinical note files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'clinical-notes' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
  )
);

DROP POLICY IF EXISTS "Doctors can delete clinical note files" ON storage.objects;
CREATE POLICY "Doctors can delete clinical note files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'clinical-notes' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
  )
);

-- Intake forms (add doctor/nurse to staff view/delete policies)
DROP POLICY IF EXISTS "Doctors can view intake form files" ON storage.objects;
CREATE POLICY "Doctors can view intake form files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'intake-forms' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
  )
);

DROP POLICY IF EXISTS "Doctors can delete intake form files" ON storage.objects;
CREATE POLICY "Doctors can delete intake form files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'intake-forms' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager', 'doctor', 'nurse')
  )
);

