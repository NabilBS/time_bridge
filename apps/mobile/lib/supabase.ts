import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Demo-Modus: Ohne Env-Variablen läuft die App ohne Backend – der komplette
 * Onboarding-Flow bleibt durchspielbar, es wird nichts gespeichert.
 */
export const isDemo = !supabaseUrl || !supabaseAnonKey;

export const supabase: SupabaseClient | null = isDemo
  ? null
  : createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

/** Token-Handling für den Magic-Link-Redirect (zeitbruecke://auth/callback). */
export async function createSessionFromUrl(url: string): Promise<void> {
  if (!supabase) return;

  const [, fragment] = url.split("#");
  const params = new URLSearchParams(fragment ?? url.split("?")[1] ?? "");

  const errorDescription = params.get("error_description");
  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return;
  }

  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  }
}
