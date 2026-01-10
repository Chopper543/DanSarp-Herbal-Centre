-- Migration: Insert initial treatments for DanSarp Herbal Centre
-- This adds the 5 main treatment offerings with their pricing information

-- 1. Cancer Care (Holistic Support)
INSERT INTO treatments (name, slug, description, condition_type, pricing, is_active)
VALUES (
  'Cancer Care (Holistic Support)',
  'cancer-care',
  'Cancer involves abnormal cell growth. Our herbal therapies focus on strengthening immunity, easing symptoms, and supporting recovery alongside conventional care.',
  'cancer',
  '{
    "consultation": 500,
    "monthly_therapy": {"min": 2000, "max": 3500},
    "lifestyle_coaching": 800,
    "follow_up": 400
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  condition_type = EXCLUDED.condition_type,
  pricing = EXCLUDED.pricing,
  updated_at = NOW();

-- 2. Diabetes Management
INSERT INTO treatments (name, slug, description, condition_type, pricing, is_active)
VALUES (
  'Diabetes Management',
  'diabetes-management',
  'Diabetes is a condition where blood sugar regulation is impaired. We provide herbal blends, dietary guidance, and lifestyle support to help balance glucose levels naturally.',
  'diabetes',
  '{
    "consultation": 400,
    "monthly_therapy": {"min": 1500, "max": 2500},
    "nutrition_coaching": 700,
    "monitoring": 300
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  condition_type = EXCLUDED.condition_type,
  pricing = EXCLUDED.pricing,
  updated_at = NOW();

-- 3. Hypertension (High Blood Pressure)
INSERT INTO treatments (name, slug, description, condition_type, pricing, is_active)
VALUES (
  'Hypertension (High Blood Pressure)',
  'hypertension',
  'Hypertension is persistently elevated blood pressure that can affect heart health. Our herbal remedies and stress-management programs aim to regulate pressure and improve circulation.',
  'hypertension',
  '{
    "consultation": 350,
    "monthly_therapy": {"min": 1200, "max": 2000},
    "stress_management_coaching": 600,
    "follow_up": 250
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  condition_type = EXCLUDED.condition_type,
  pricing = EXCLUDED.pricing,
  updated_at = NOW();

-- 4. Infertility Support
INSERT INTO treatments (name, slug, description, condition_type, pricing, is_active)
VALUES (
  'Infertility Support',
  'infertility-support',
  'Infertility can arise from hormonal, lifestyle, or health factors. We use herbal formulations, nutritional support, and counseling to promote reproductive health.',
  'infertility',
  '{
    "consultation": 600,
    "monthly_therapy": {"min": 2500, "max": 4000},
    "counseling": 900,
    "monitoring": 400
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  condition_type = EXCLUDED.condition_type,
  pricing = EXCLUDED.pricing,
  updated_at = NOW();

-- 5. General Wellness & Immunity Boost
INSERT INTO treatments (name, slug, description, condition_type, pricing, is_active)
VALUES (
  'General Wellness & Immunity Boost',
  'general-wellness',
  'For individuals seeking preventive care, we offer herbal tonics and lifestyle programs to strengthen immunity and maintain vitality.',
  'wellness',
  '{
    "consultation": 300,
    "monthly_therapy": {"min": 1000, "max": 1800},
    "wellness_coaching": 500,
    "follow_up": 200
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  condition_type = EXCLUDED.condition_type,
  pricing = EXCLUDED.pricing,
  updated_at = NOW();
