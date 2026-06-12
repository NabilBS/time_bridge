// Edge Function process-outbox – versendet ungesendete Benachrichtigungen über
// den Expo Push Service. Per Cron-Trigger jede Minute aufrufen.
// Idempotent: claim_outbox_batch sperrt Zeilen (for update skip locked), zwei
// parallele Läufe greifen nie dieselbe Zeile.
//
// Datensparsamkeit: Pushes nennen nur Anlass und Absendername, niemals
// Nachrichteninhalte oder Dokumentdaten.

import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type NotificationKind =
  | "request_received"
  | "request_accepted"
  | "message_received"
  | "verification_decided"
  | "meeting_reminder";

interface OutboxRow {
  id: string;
  recipient_id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  attempts: number;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/** Deutsche Push-Texte – zentral, ohne Inhalte. */
function buildMessage(row: OutboxRow): { title: string; body: string } {
  const name = (row.payload.name as string | undefined) ?? "Jemand";
  switch (row.kind) {
    case "request_received":
      return { title: "Neue Anfrage", body: `${name} möchte Sie kennenlernen.` };
    case "request_accepted":
      return { title: "Anfrage angenommen", body: `${name} freut sich auf Ihre Nachricht.` };
    case "message_received":
      return { title: `Neue Nachricht von ${name}`, body: "Tippen Sie, um zu antworten." };
    case "verification_decided": {
      const status = row.payload.status as string | undefined;
      if (status === "approved") {
        return {
          title: "Nachweis geprüft",
          body: "Ihr Nachweis wurde geprüft – Ihre Vertrauensstufe ist gestiegen.",
        };
      }
      if (status === "rejected") {
        return {
          title: "Nachweis geprüft",
          body: "Ihr Nachweis konnte nicht bestätigt werden – bitte reichen Sie ihn erneut ein.",
        };
      }
      return {
        title: "Nachweis abgelaufen",
        body: "Ihr Nachweis ist abgelaufen – bitte erneuern Sie ihn.",
      };
    }
    case "meeting_reminder":
      return {
        title: "Erinnerung an Ihr Treffen",
        body: "Ihr Treffen über Zeitbrücke ist morgen.",
      };
  }
}

/** Deep-Link-Daten fürs Antippen der Benachrichtigung. */
function buildData(row: OutboxRow): Record<string, unknown> {
  return { kind: row.kind, ...row.payload, name: undefined };
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response("Missing configuration", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: claimed, error: claimError } = await supabase.rpc("claim_outbox_batch", {
    p_limit: 100,
  });
  if (claimError) {
    console.error("claim_outbox_batch failed", { message: claimError.message });
    return new Response("claim failed", { status: 500 });
  }

  const rows = (claimed ?? []) as OutboxRow[];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "content-type": "application/json" },
    });
  }

  let sentCount = 0;

  for (const row of rows) {
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("expo_token")
      .eq("profile_id", row.recipient_id);

    const recipientTokens = (tokens ?? []).map((t) => t.expo_token as string);

    // Kein Token: nichts zuzustellen – Eintrag abschließen, nicht endlos retryen.
    if (recipientTokens.length === 0) {
      await supabase
        .from("notification_outbox")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }

    const { title, body } = buildMessage(row);
    const messages: ExpoMessage[] = recipientTokens.map((token) => ({
      to: token,
      title,
      body,
      data: buildData(row),
    }));

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(messages),
      });
      const result = await response.json();
      const tickets = (result.data ?? []) as { status: string; details?: { error?: string } }[];

      // Abgemeldete Geräte aufräumen.
      await Promise.all(
        tickets.map(async (ticket, index) => {
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
            await supabase.from("push_tokens").delete().eq("expo_token", recipientTokens[index]);
          }
        }),
      );

      await supabase
        .from("notification_outbox")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sentCount += 1;
    } catch (error) {
      // Ohne personenbezogene Payload loggen; Eintrag bleibt unsent (Retry).
      // Ab 5 Versuchen verwirft claim_outbox_batch ihn von selbst.
      console.error("push send failed", {
        outbox_id: row.id,
        kind: row.kind,
        attempts: row.attempts,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return new Response(JSON.stringify({ processed: rows.length, sent: sentCount }), {
    headers: { "content-type": "application/json" },
  });
});
