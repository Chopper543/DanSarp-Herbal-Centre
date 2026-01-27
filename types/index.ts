export type UserRole =
  | "super_admin"
  | "admin"
  | "content_manager"
  | "appointment_manager"
  | "finance_manager"
  | "user";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  email_verified: boolean;
  two_factor_enabled: boolean;
  two_factor_secret?: string | null;
  two_factor_backup_codes?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  avatar_url: string | null;
  bio: string | null;
  preferences: {
    theme?: "light" | "dark";
    notifications?: boolean;
  };
}

export interface Appointment {
  id: string;
  user_id: string;
  branch_id: string;
  appointment_date: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  treatment_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  working_hours: {
    [key: string]: {
      open: string;
      close: string;
      closed?: boolean;
    };
  };
  is_active: boolean;
}

export interface Treatment {
  id: string;
  name: string;
  slug: string;
  description: string;
  condition_type: string;
  pricing: {
    consultation: number;
    monthly_therapy: {
      min: number;
      max: number;
    };
    lifestyle_coaching: number;
    follow_up: number;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  rating: number;
  title: string;
  content: string;
  is_verified: boolean;
  is_approved: boolean;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type GalleryItemType = "doctor" | "event" | "clinic" | "achievement";

export interface GalleryItem {
  id: string;
  type: GalleryItemType;
  title: string;
  description: string | null;
  image_urls: string[];
  video_url: string | null;
  metadata: Record<string, any>;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface Testimonial {
  id: string;
  patient_name: string | null;
  content: string;
  media_type: "image" | "audio" | "video";
  media_url: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod =
  | "mtn_momo"
  | "vodafone_cash"
  | "airteltigo"
  | "bank_transfer"
  | "card"
  | "ghqr"
  | "wallet"
  | "cod";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded"
  | "expired";

export interface Payment {
  id: string;
  user_id: string;
  appointment_id: string | null;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  provider: "paystack" | "flutterwave" | "custom";
  provider_transaction_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author_id: string;
  featured_image_url: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationProfile {
  id: string;
  mission: string;
  vision: string;
  values: string;
  team_members: Array<{
    name: string;
    role: string;
    bio: string;
    image_url: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    issue_date: string;
    image_url: string;
  }>;
  created_at: string;
  updated_at: string;
}

export type GenderType = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type MaritalStatusType = 'single' | 'married' | 'divorced' | 'widowed' | 'separated';

export interface DoctorNote {
  date: string;
  doctor: string;
  report: string;
  attachments?: string[];
}

export interface MedicalHistoryEntry {
  condition: string;
  started: string;
  ended?: string;
  notes?: string;
}

export interface PatientRecord {
  id: string;
  user_id: string;
  
  // Demographics
  date_of_birth?: string;
  age?: number;
  gender?: GenderType;
  marital_status?: MaritalStatusType;
  occupation?: string;
  
  // Contact Information
  home_address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  alternative_phone?: string;
  
  // Emergency Contact
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  
  // Medical Information
  primary_condition?: string;
  condition_started_date?: string;
  medical_history?: MedicalHistoryEntry[];
  allergies?: string[];
  current_medications?: string[];
  blood_type?: string;
  
  // Visit Tracking
  first_visit_date?: string;
  last_visit_date?: string;
  total_visits?: number;
  
  // Doctor's Reports
  doctor_notes?: DoctorNote[];
  
  // Additional Information
  insurance_provider?: string;
  insurance_number?: string;
  referral_source?: string;
  preferred_language?: string;
  notes?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export type PrescriptionStatus = "draft" | "active" | "completed" | "cancelled" | "expired";

export interface HerbFormula {
  name: string;
  quantity: number;
  unit: string; // e.g., "grams", "ml", "tablets"
  dosage: string; // e.g., "2 tablets twice daily"
  instructions?: string;
}

export interface Prescription {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  herbs_formulas: HerbFormula[];
  instructions: string | null;
  duration_days: number | null;
  refills_remaining: number;
  refills_original: number;
  prescribed_date: string;
  expiry_date: string | null;
  start_date: string | null;
  end_date: string | null;
  status: PrescriptionStatus;
  doctor_notes: string | null;
  patient_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export type RefillStatus = "pending" | "approved" | "rejected" | "fulfilled";

export interface PrescriptionRefill {
  id: string;
  prescription_id: string;
  patient_id: string;
  requested_date: string;
  requested_refills: number;
  status: RefillStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type TreatmentPlanStatus = "draft" | "active" | "completed" | "cancelled" | "on_hold";

export interface TreatmentPlanProgressNote {
  date: string;
  note: string;
  progress_percentage: number;
}

export interface TreatmentPlan {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  title: string;
  description: string | null;
  diagnosis: string | null;
  goals: string[];
  treatment_approach: string | null;
  start_date: string;
  end_date: string | null;
  estimated_duration_days: number | null;
  status: TreatmentPlanStatus;
  progress_notes: TreatmentPlanProgressNote[];
  current_progress: number;
  follow_up_required: boolean;
  follow_up_interval_days: number | null;
  next_follow_up_date: string | null;
  template_id: string | null;
  doctor_notes: string | null;
  patient_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export type FollowUpStatus = "scheduled" | "completed" | "cancelled" | "missed";

export interface TreatmentPlanFollowUp {
  id: string;
  treatment_plan_id: string;
  appointment_id: string | null;
  scheduled_date: string;
  follow_up_type: string | null;
  status: FollowUpStatus;
  notes: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// LAB RESULTS TYPES
// ============================================================================

export type LabResultStatus = "pending" | "in_progress" | "completed" | "cancelled" | "reviewed";

export interface TestResult {
  [key: string]: string | number | null; // Key-value pairs for test results
}

export interface LabResult {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  test_name: string;
  test_type: string | null;
  ordered_date: string;
  completed_date: string | null;
  results: TestResult;
  normal_range: string | null;
  units: string | null;
  file_urls: string[];
  status: LabResultStatus;
  notes: string | null;
  doctor_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ============================================================================
// CLINICAL NOTES TYPES (SOAP Notes)
// ============================================================================

export type NoteType = "soap" | "progress" | "general";

export interface VitalSigns {
  blood_pressure?: string; // e.g., "120/80"
  pulse?: number;
  temperature?: number;
  temperature_unit?: "celsius" | "fahrenheit";
  weight?: number;
  weight_unit?: "kg" | "lbs";
  height?: number;
  height_unit?: "cm" | "ft";
  respiratory_rate?: number;
  oxygen_saturation?: number;
  [key: string]: any; // Allow additional vital signs
}

export interface ClinicalNote {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  note_type: NoteType;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  vital_signs: VitalSigns;
  diagnosis_codes: string[];
  template_id: string | null;
  is_template: boolean;
  attachments: string[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ============================================================================
// INTAKE FORMS TYPES
// ============================================================================

export type FormFieldType = "text" | "textarea" | "select" | "checkbox" | "radio" | "date" | "file" | "number" | "email" | "tel";

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // For select, radio, checkbox
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  conditional?: {
    field: string;
    value: any;
    operator?: "equals" | "not_equals" | "contains";
  };
  help_text?: string;
}

export interface FormSchema {
  fields: FormField[];
  sections?: Array<{
    title: string;
    fields: string[]; // Field IDs
  }>;
  submit_button_text?: string;
  success_message?: string;
}

export interface IntakeForm {
  id: string;
  name: string;
  description: string | null;
  form_schema: FormSchema;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export type IntakeFormResponseStatus = "draft" | "submitted" | "reviewed" | "approved" | "rejected";

export interface IntakeFormResponse {
  id: string;
  form_id: string;
  patient_id: string;
  appointment_id: string | null;
  response_data: Record<string, any>; // Dynamic response data matching form schema
  status: IntakeFormResponseStatus;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}
