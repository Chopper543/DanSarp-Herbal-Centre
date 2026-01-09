export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          avatar_url: string | null;
          bio: string | null;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          avatar_url?: string | null;
          bio?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          avatar_url?: string | null;
          bio?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          role: string;
          email_verified: boolean;
          two_factor_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          role?: string;
          email_verified?: boolean;
          two_factor_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          role?: string;
          email_verified?: boolean;
          two_factor_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          user_id: string;
          branch_id: string;
          appointment_date: string;
          status: "pending" | "confirmed" | "completed" | "cancelled";
          treatment_type: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          branch_id: string;
          appointment_date: string;
          status?: "pending" | "confirmed" | "completed" | "cancelled";
          treatment_type: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          branch_id?: string;
          appointment_date?: string;
          status?: "pending" | "confirmed" | "completed" | "cancelled";
          treatment_type?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          appointment_id: string | null;
          amount: number;
          currency: string;
          payment_method: string;
          status: "pending" | "processing" | "completed" | "failed" | "refunded";
          provider: string;
          provider_transaction_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          appointment_id?: string | null;
          amount: number;
          currency?: string;
          payment_method: string;
          status?: "pending" | "processing" | "completed" | "failed" | "refunded";
          provider: string;
          provider_transaction_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          appointment_id?: string | null;
          amount?: number;
          currency?: string;
          payment_method?: string;
          status?: "pending" | "processing" | "completed" | "failed" | "refunded";
          provider?: string;
          provider_transaction_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      organization_profile: {
        Row: {
          id: string;
          mission: string;
          vision: string;
          values: string;
          team_members: Json;
          certifications: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mission: string;
          vision: string;
          values: string;
          team_members?: Json;
          certifications?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mission?: string;
          vision?: string;
          values?: string;
          team_members?: Json;
          certifications?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      blog_posts: {
        Row: {
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
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          excerpt: string;
          content: string;
          author_id: string;
          featured_image_url?: string | null;
          status?: "draft" | "published";
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          excerpt?: string;
          content?: string;
          author_id?: string;
          featured_image_url?: string | null;
          status?: "draft" | "published";
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      branches: {
        Row: {
          id: string;
          name: string;
          address: string;
          phone: string;
          email: string;
          coordinates: string | { x: number; y: number } | { lat: number; lng: number };
          working_hours: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          phone: string;
          email: string;
          coordinates: string | { x: number; y: number } | { lat: number; lng: number };
          working_hours: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          phone?: string;
          email?: string;
          coordinates?: string | { x: number; y: number } | { lat: number; lng: number };
          working_hours?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      gallery_items: {
        Row: {
          id: string;
          type: "doctor" | "event" | "clinic" | "achievement";
          title: string;
          description: string | null;
          image_urls: string[];
          video_url: string | null;
          metadata: Json;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: "doctor" | "event" | "clinic" | "achievement";
          title: string;
          description?: string | null;
          image_urls?: string[];
          video_url?: string | null;
          metadata?: Json;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: "doctor" | "event" | "clinic" | "achievement";
          title?: string;
          description?: string | null;
          image_urls?: string[];
          video_url?: string | null;
          metadata?: Json;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      treatments: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string;
          condition_type: string;
          pricing: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description: string;
          condition_type: string;
          pricing: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string;
          condition_type?: string;
          pricing?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      testimonials: {
        Row: {
          id: string;
          patient_name: string | null;
          content: string;
          media_type: "image" | "audio" | "video";
          media_url: string;
          is_approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_name?: string | null;
          content: string;
          media_type: "image" | "audio" | "video";
          media_url: string;
          is_approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_name?: string | null;
          content?: string;
          media_type?: "image" | "audio" | "video";
          media_url?: string;
          is_approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      reviews: {
        Row: {
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
        };
        Insert: {
          id?: string;
          user_id: string;
          rating: number;
          title: string;
          content: string;
          is_verified?: boolean;
          is_approved?: boolean;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          rating?: number;
          title?: string;
          content?: string;
          is_verified?: boolean;
          is_approved?: boolean;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      [key: string]: any;
    };
  };
}
