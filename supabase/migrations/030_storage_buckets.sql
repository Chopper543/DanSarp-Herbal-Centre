-- ============================================================================
-- STORAGE BUCKETS AND POLICIES
-- ============================================================================
-- Storage buckets for lab results, clinical notes, and intake forms
-- IMPORTANT: Before running this migration, manually create these storage buckets
-- in Supabase Dashboard → Storage:
--   1. lab-results
--   2. clinical-notes
--   3. intake-forms
-- ============================================================================

-- ============================================================================
-- LAB RESULTS STORAGE POLICIES
-- ============================================================================

-- Patients can view their own lab result files
CREATE POLICY "Patients can view own lab result files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lab-results' AND
  EXISTS (
    SELECT 1 FROM lab_results
    WHERE lab_results.file_urls @> ARRAY[storage.objects.name]
    AND lab_results.patient_id = auth.uid()
  )
);

-- Doctors and admins can view all lab result files
CREATE POLICY "Doctors can view lab result files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lab-results' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager')
  )
);

-- Doctors and admins can upload lab result files
CREATE POLICY "Doctors can upload lab result files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lab-results' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager')
  )
);

-- Doctors and admins can delete lab result files
CREATE POLICY "Doctors can delete lab result files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lab-results' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager')
  )
);

-- ============================================================================
-- CLINICAL NOTES STORAGE POLICIES
-- ============================================================================

-- Patients can view their own clinical note attachments
CREATE POLICY "Patients can view own clinical note files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'clinical-notes' AND
  EXISTS (
    SELECT 1 FROM clinical_notes
    WHERE clinical_notes.attachments @> ARRAY[storage.objects.name]
    AND clinical_notes.patient_id = auth.uid()
  )
);

-- Doctors and admins can view all clinical note files
CREATE POLICY "Doctors can view clinical note files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'clinical-notes' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager')
  )
);

-- Doctors and admins can upload clinical note files
CREATE POLICY "Doctors can upload clinical note files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'clinical-notes' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager')
  )
);

-- Doctors and admins can delete clinical note files
CREATE POLICY "Doctors can delete clinical note files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'clinical-notes' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager')
  )
);

-- ============================================================================
-- INTAKE FORMS STORAGE POLICIES
-- ============================================================================

-- Patients can view their own intake form file uploads
CREATE POLICY "Patients can view own intake form files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'intake-forms' AND
  (
    -- Files in user's own folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Files referenced in their responses
    EXISTS (
      SELECT 1 FROM intake_form_responses
      WHERE intake_form_responses.response_data::text LIKE '%' || storage.objects.name || '%'
      AND intake_form_responses.patient_id = auth.uid()
    )
  )
);

-- Doctors and admins can view all intake form files
CREATE POLICY "Doctors can view intake form files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'intake-forms' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager')
  )
);

-- Patients can upload intake form files in their own folder
CREATE POLICY "Patients can upload intake form files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'intake-forms' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Patients can delete their own intake form files
CREATE POLICY "Patients can delete own intake form files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'intake-forms' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Doctors and admins can delete any intake form files
CREATE POLICY "Doctors can delete intake form files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'intake-forms' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin', 'appointment_manager')
  )
);
