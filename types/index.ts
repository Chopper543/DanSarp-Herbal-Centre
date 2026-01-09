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
  | "refunded";

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
