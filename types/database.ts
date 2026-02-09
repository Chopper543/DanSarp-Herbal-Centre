export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type GenericTable<Row = Record<string, any>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: any[];
};

export type Database = {
  public: {
    Tables: {
      users: GenericTable<{
        id: string;
        email: string | null;
        full_name: string | null;
        phone: string | null;
        role: string | null;
        email_verified: boolean | null;
        two_factor_enabled: boolean | null;
        two_factor_secret: string | null;
        two_factor_backup_codes: string[] | null;
        avatar_url?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      appointments: GenericTable<{
        id: string;
        user_id: string;
        branch_id: string | null;
        appointment_date: string;
        status: "pending" | "confirmed" | "completed" | "cancelled";
        treatment_type: string | null;
        notes: string | null;
        metadata?: Json | null;
        appointment_time?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      branches: GenericTable<{
        id: string;
        name: string;
        address: string | null;
        phone: string | null;
        email: string | null;
        coordinates: Json | null;
        working_hours: Json | null;
        is_active: boolean;
        created_at?: string;
        updated_at?: string;
      }>;
      payments: GenericTable<{
        id: string;
        user_id: string | null;
        appointment_id: string | null;
        amount: number;
        currency: string;
        payment_method:
          | "mtn_momo"
          | "vodafone_cash"
          | "airteltigo"
          | "bank_transfer"
          | "card"
          | "ghqr"
          | "wallet"
          | "cod"
          | string;
        status: "pending" | "processing" | "completed" | "failed" | "refunded" | "expired" | string;
        provider: "paystack" | "flutterwave" | "custom" | string;
        provider_transaction_id: string | null;
        metadata: Json | null;
        appointment_id_temp?: string | null;
        appointment_data?: Json | null;
        created_at?: string;
        updated_at?: string;
      }>;
      payment_ledger: GenericTable<{
        id: string;
        payment_id: string;
        amount: number;
        status: string;
        created_at?: string;
        metadata?: Json | null;
      }>;
      patient_records: GenericTable<{
        id: string;
        patient_id: string;
        doctor_id: string | null;
        appointment_id: string | null;
        record_type: string | null;
        data: Json | null;
        notes: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      clinical_notes: GenericTable<{
        id: string;
        patient_id: string;
        doctor_id: string;
        appointment_id: string | null;
        note_type: string | null;
        content: Json | null;
        status: string | null;
        created_at?: string;
        updated_at?: string;
        updated_by?: string | null;
      }>;
      lab_results: GenericTable<{
        id: string;
        patient_id: string;
        doctor_id: string;
        appointment_id: string | null;
        test_name: string;
        test_type: string | null;
        ordered_date: string | null;
        completed_date: string | null;
        results: Json | null;
        normal_range: string | null;
        units: string | null;
        file_urls: string[] | null;
        status: "pending" | "in_progress" | "completed" | "cancelled" | string;
        notes: string | null;
        doctor_notes: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      prescriptions: GenericTable<{
        id: string;
        patient_id: string;
        doctor_id: string;
        appointment_id: string | null;
        herbs_formulas: Json | null;
        instructions: string | null;
        duration_days: number | null;
        refills_remaining: number | null;
        refills_original: number | null;
        expiry_date: string | null;
        start_date: string | null;
        end_date: string | null;
        status: "active" | "completed" | "cancelled" | "expired" | string;
        doctor_notes: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      intake_forms: GenericTable<{
        id: string;
        title: string;
        description: string | null;
        form_schema: Json;
        is_active: boolean;
        created_by: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      intake_form_responses: GenericTable<{
        id: string;
        form_id: string;
        user_id: string;
        responses: Json;
        created_at?: string;
        updated_at?: string;
      }>;
      messages: GenericTable<{
        id: string;
        sender_id: string;
        recipient_id: string;
        appointment_id: string | null;
        subject: string;
        content: string;
        is_read: boolean;
        created_at?: string;
        updated_at?: string;
      }>;
      newsletter_subscribers: GenericTable<{
        id: string;
        email: string;
        is_active: boolean;
        subscribed_at: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      organization_profile: GenericTable<{
        id?: string;
        mission: string;
        vision: string;
        values: string;
        team_members: Json | null;
        certifications: Json | null;
        created_at?: string;
        updated_at?: string;
      }>;
      reviews: GenericTable<{
        id: string;
        user_id: string | null;
        rating: number;
        title: string | null;
        content: string | null;
        is_verified: boolean | null;
        is_approved: boolean | null;
        admin_notes: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      testimonials: GenericTable<{
        id: string;
        patient_name: string | null;
        content: string;
        media_type: string | null;
        media_url: string | null;
        is_approved: boolean | null;
        created_at?: string;
        updated_at?: string;
      }>;
      gallery: GenericTable<{
        id: string;
        type: string | null;
        title: string | null;
        description: string | null;
        image_urls: string[] | null;
        video_url: string | null;
        metadata: Json | null;
        is_featured: boolean | null;
        created_at?: string;
        updated_at?: string;
      }>;
      treatments: GenericTable<{
        id: string;
        name: string;
        slug: string | null;
        description: string | null;
        condition_type: string | null;
        pricing: Json | null;
        is_active: boolean | null;
        created_at?: string;
        updated_at?: string;
      }>;
      treatment_plans: GenericTable<{
        id: string;
        user_id: string;
        plan_details: Json | null;
        status: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      blog_posts: GenericTable<{
        id: string;
        title: string;
        slug: string;
        excerpt: string | null;
        content: string | null;
        author_id: string | null;
        featured_image_url: string | null;
        status: string | null;
        published_at: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      storage_objects: GenericTable<{
        id: string;
        bucket_id: string;
        name: string;
        owner: string | null;
        created_at?: string;
        updated_at?: string;
        metadata?: Json | null;
      }>;
      [key: string]: GenericTable;
    };
    Views: Record<string, GenericTable>;
    Functions: Record<string, any>;
    Enums: {
      user_role:
        | "super_admin"
        | "admin"
        | "content_manager"
        | "appointment_manager"
        | "finance_manager"
        | "doctor"
        | "nurse"
        | "user";
      payment_status: "pending" | "processing" | "completed" | "failed" | "refunded" | "expired";
      payment_method:
        | "mtn_momo"
        | "vodafone_cash"
        | "airteltigo"
        | "bank_transfer"
        | "card"
        | "ghqr"
        | "wallet"
        | "cod";
      lab_result_status: "pending" | "in_progress" | "completed" | "cancelled";
      prescription_status: "active" | "completed" | "cancelled" | "expired";
      [key: string]: string;
    };
  };
};
