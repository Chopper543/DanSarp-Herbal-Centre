import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

/**
 * Service-role Supabase client for backend-only operations
 * Uses service role key; do not expose to clients.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase service client is not configured (missing URL or service role key)");
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });
}
