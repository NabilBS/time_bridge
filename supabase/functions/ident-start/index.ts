// Edge Function ident-start (auth-pflichtig): legt eine Ident-Session beim
// Anbieter an und gibt NUR die Redirect-URL zurück.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { getIdentAdapter } from "../_shared/ident-adapter.ts";

const APP_CALLBACK_URL = "zeitbruecke://ident/callback";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Konfiguration fehlt." }, 500);

  // Aufrufer über sein JWT identifizieren – die Function läuft mit verify_jwt.
  const authHeader = request.headers.get("authorization") ?? "";
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const profileId = userData.user?.id;
  if (userError || !profileId) return json({ error: "Nicht angemeldet." }, 401);

  const admin = createClient(supabaseUrl, serviceKey);

  // Bereits bestätigt? Dann gibt es nichts zu identifizieren.
  const { data: approved } = await admin
    .from("verifications")
    .select("id")
    .eq("profile_id", profileId)
    .eq("type", "video_ident")
    .eq("status", "approved")
    .maybeSingle();
  if (approved) {
    return json({ error: "Ihre Identität ist bereits bestätigt." }, 409);
  }

  // Offene Session? Doppelstart verhindern, vorhandene URL erneut verwendbar machen.
  const { data: open } = await admin
    .from("ident_sessions")
    .select("id")
    .eq("profile_id", profileId)
    .eq("status", "created")
    .maybeSingle();
  if (open) {
    return json(
      { error: "Eine Identifizierung läuft bereits – das Ergebnis kommt in wenigen Minuten." },
      409,
    );
  }

  try {
    const adapter = getIdentAdapter();
    const session = await adapter.createSession(profileId, APP_CALLBACK_URL);

    const { error: insertError } = await admin.from("ident_sessions").insert({
      profile_id: profileId,
      provider: adapter.name,
      provider_session_id: session.providerSessionId,
    });
    if (insertError) {
      // 23505 = parallele offene Session (Unique-Index)
      if ((insertError as { code?: string }).code === "23505") {
        return json({ error: "Eine Identifizierung läuft bereits." }, 409);
      }
      throw insertError;
    }

    return json({ redirect_url: session.redirectUrl });
  } catch (error) {
    console.error("ident-start failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return json(
      { error: "Die Identifizierung kann gerade nicht gestartet werden – bitte versuchen Sie es später erneut." },
      502,
    );
  }
});
