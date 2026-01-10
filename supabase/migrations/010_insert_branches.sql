-- Migration: Insert two branches for DanSarp Herbal Centre
-- Branch 1: Nkawkaw (Oframase New Road)
-- Branch 2: Koforidua (Gyamfikrom-Guabeng, North Koforidua)

-- Standard working hours for both branches
-- Monday-Friday: 8:00 AM - 5:00 PM
-- Saturday: 9:00 AM - 2:00 PM
-- Sunday: Closed
DO $$
DECLARE
  default_working_hours JSONB := '{
    "monday": {"open": "08:00", "close": "17:00"},
    "tuesday": {"open": "08:00", "close": "17:00"},
    "wednesday": {"open": "08:00", "close": "17:00"},
    "thursday": {"open": "08:00", "close": "17:00"},
    "friday": {"open": "08:00", "close": "17:00"},
    "saturday": {"open": "09:00", "close": "14:00"},
    "sunday": {"closed": true}
  }'::jsonb;
BEGIN
  -- Branch 1: Nkawkaw
  -- Coordinates: Nkawkaw, Ghana (approximately 6.5500° N, 0.7667° W)
  -- PostgreSQL POINT format: POINT(longitude latitude) = POINT(-0.7667 6.5500)
  INSERT INTO branches (name, address, phone, email, coordinates, working_hours, image_urls, is_active)
  SELECT
    'Nkawkaw Branch',
    'Oframase New Road, Nkawkaw',
    '0246906739',
    'info@dansarpherbal.com',
    POINT(-0.7667, 6.5500), -- longitude, latitude
    default_working_hours,
    '[]'::jsonb, -- Placeholder for 2 photos - will be updated manually later
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM branches WHERE name = 'Nkawkaw Branch'
  );

  -- Branch 2: Koforidua
  -- Coordinates: Koforidua, Ghana (approximately 6.0833° N, 0.2667° W)
  -- PostgreSQL POINT format: POINT(longitude latitude) = POINT(-0.2667 6.0833)
  INSERT INTO branches (name, address, phone, email, coordinates, working_hours, image_urls, is_active)
  SELECT
    'Koforidua Branch',
    'Gyamfikrom-Guabeng, North Koforidua',
    '0246225405',
    'info@dansarpherbal.com',
    POINT(-0.2667, 6.0833), -- longitude, latitude
    default_working_hours,
    '[]'::jsonb, -- Placeholder for 2 photos - will be updated manually later
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM branches WHERE name = 'Koforidua Branch'
  );
END $$;
