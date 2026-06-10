import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase-Client mit Service-Role-Key.
 * Ausschließlich serverseitig verwenden (Server Components, Server Actions,
 * Route Handler) – der Import von "server-only" macht jeden Import in einer
 * Client-Komponente zum Build-Fehler.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein (siehe .env.example).",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
