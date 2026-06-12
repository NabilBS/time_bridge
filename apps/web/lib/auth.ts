import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string;
}

/** Allowlist-Prüfung gegen ADMIN_EMAILS (kommagetrennt, case-insensitive). */
export function isAllowedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return allowlist.includes(email.trim().toLowerCase());
}

/**
 * Erzwingt eine angemeldete Person auf der Allowlist.
 * Ohne Session → /login, ohne Allowlist-Treffer → /403.
 * In jedem Layout-Check UND in jeder Server Action aufrufen.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  if (!isAllowedAdmin(user.email)) {
    redirect("/403");
  }

  return { id: user.id, email: user.email as string };
}
