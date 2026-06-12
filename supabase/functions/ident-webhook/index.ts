// Edge Function ident-webhook: öffentlich erreichbar, aber abgesichert.
// Deploy mit --no-verify-jwt; die Sicherheit liegt in der Signaturprüfung.
//
// Datenminimierung: verarbeitet ausschließlich Session-Referenz + Ergebnis
// (bestanden/nicht bestanden). Der Body wird bei ungültiger Signatur NICHT
// geloggt; auch sonst landen keine Ausweis-/Bilddaten in Logs oder DB.

import { createClient } from "jsr:@supabase/supabase-js@2";

const REJECT_NOTE =
  "Identifizierung nicht abgeschlossen – Sie können es erneut versuchen oder einen Video-Termin buchen.";

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (request) => {
  const secret = Deno.env.get("IDENT_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !supabaseUrl || !serviceKey) {
    return new Response("configuration missing", { status: 500 });
  }

  // Signaturprüfung ist die erste Zeile – ungültig => 401, kein Body-Logging.
  const rawBody = await request.text();
  const givenSignature = request.headers.get("x-ident-signature") ?? "";
  const expectedSignature = await hmacHex(secret, rawBody);
  if (!timingSafeEqual(givenSignature, expectedSignature)) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: { session_id?: unknown; result?: unknown };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid payload", { status: 400 });
  }
  const providerSessionId = typeof payload.session_id === "string" ? payload.session_id : null;
  const passed = payload.result === "success";
  if (!providerSessionId) {
    return new Response("invalid payload", { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Idempotent: nur eine noch offene Session wird verarbeitet. Doppelter
  // Callback oder unbekannte/fremde Session => folgenlos (200, "ignored").
  const { data: claimed, error: claimError } = await admin
    .from("ident_sessions")
    .update({
      status: passed ? "completed" : "failed",
      completed_at: new Date().toISOString(),
    })
    .eq("provider_session_id", providerSessionId)
    .eq("status", "created")
    .select("id, profile_id")
    .maybeSingle();
  if (claimError) {
    console.error("ident-webhook claim failed", { message: claimError.message });
    return new Response("error", { status: 500 });
  }
  if (!claimed) {
    return new Response(JSON.stringify({ processed: false }), {
      headers: { "content-type": "application/json" },
    });
  }

  // Ergebnis in verifications spiegeln – der Trigger aus 0001 hebt/prüft die
  // Vertrauensstufe von selbst, ohne App-Code.
  const { error: verificationError } = await admin.from("verifications").insert({
    profile_id: claimed.profile_id,
    type: "video_ident",
    status: passed ? "approved" : "rejected",
    review_note: passed ? null : REJECT_NOTE,
  });
  if (verificationError) {
    console.error("ident-webhook verification insert failed", {
      message: verificationError.message,
    });
    return new Response("error", { status: 500 });
  }

  return new Response(JSON.stringify({ processed: true }), {
    headers: { "content-type": "application/json" },
  });
});
