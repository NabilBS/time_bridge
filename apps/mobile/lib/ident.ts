import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { EDGE_IDENT_START, type IdentSessionStatus } from "@zeitbruecke/shared";

import { isDemo, supabase } from "@/lib/supabase";
import { simulateDemoApproval, submitVerification } from "@/lib/verifications";

export const IDENT_OFFLINE_MESSAGE =
  "Die Identifizierung kann gerade nicht gestartet werden – bitte versuchen Sie es später erneut.";

export interface IdentSessionInfo {
  status: IdentSessionStatus;
  created_at: string;
}

const DEMO_KEY = "zeitbruecke.identSession.demo.v1";
const DEMO_COMPLETE_AFTER_MS = 3000;

interface DemoIdentSession {
  id: string;
  status: IdentSessionStatus;
  created_at: string;
}

/**
 * Demo: simulierte Session, die sich 3 s nach dem Start selbst abschließt
 * und die Vertrauensstufe über den Demo-Verifizierungs-Store hebt.
 */
async function loadDemoSession(): Promise<DemoIdentSession | null> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as DemoIdentSession;
    if (
      session.status === "created" &&
      Date.now() - new Date(session.created_at).getTime() > DEMO_COMPLETE_AFTER_MS
    ) {
      session.status = "completed";
      await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(session)).catch(() => undefined);
      await submitVerification("video_ident", null).catch(() => undefined);
      await simulateDemoApproval("video_ident").catch(() => undefined);
    }
    return session;
  } catch {
    return null;
  }
}

export async function loadLatestIdentSession(): Promise<IdentSessionInfo | null> {
  if (isDemo || !supabase) {
    const session = await loadDemoSession();
    return session ? { status: session.status, created_at: session.created_at } : null;
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  const { data } = await supabase
    .from("ident_sessions")
    .select("status, created_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as IdentSessionInfo | null) ?? null;
}

/** Startet eine Ident-Session und liefert die Redirect-URL des Anbieters. */
export async function startIdentSession(): Promise<string> {
  if (isDemo || !supabase) {
    const session: DemoIdentSession = {
      id: Crypto.randomUUID(),
      status: "created",
      created_at: new Date().toISOString(),
    };
    await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(session)).catch(() => undefined);
    // Demo: kein echter Anbieter – direkt zurück in die App.
    return "zeitbruecke://ident/callback";
  }

  const { data, error } = await supabase.functions.invoke(EDGE_IDENT_START, { body: {} });
  if (error) {
    // Die Function liefert deutsche Fehlertexte (z. B. „läuft bereits").
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    if (context?.json) {
      const body = await context.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    throw new Error(IDENT_OFFLINE_MESSAGE);
  }
  const redirectUrl = (data as { redirect_url?: string } | null)?.redirect_url;
  if (!redirectUrl) throw new Error(IDENT_OFFLINE_MESSAGE);
  return redirectUrl;
}
