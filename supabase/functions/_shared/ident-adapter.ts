// Dünner, anbieterneutraler Adapter für Selfie-Ident-Anbieter.
// Anbieterwechsel = neue createSession-Implementierung, keine App-Änderung.
//
// Datenminimierung als Architektur: Der Adapter gibt nur eine Session-Referenz
// und eine Redirect-URL zurück. Ausweisdaten, Geburtsdaten oder Bilddaten
// erreichen Zeitbrücke nie – sie bleiben beim Anbieter (AVV).

export interface IdentProviderSession {
  providerSessionId: string;
  redirectUrl: string;
}

export interface IdentAdapter {
  name: string;
  createSession(profileId: string, callbackUrl: string): Promise<IdentProviderSession>;
}

/** Sandbox/Demo-Adapter: erzeugt eine lokale Session ohne externen Aufruf. */
const mockAdapter: IdentAdapter = {
  name: "mock",
  // deno-lint-ignore require-await
  async createSession(_profileId, callbackUrl) {
    const providerSessionId = crypto.randomUUID();
    return {
      providerSessionId,
      redirectUrl: `${callbackUrl}?mock_session=${providerSessionId}`,
    };
  },
};

/**
 * Generischer REST-Adapter als Vorlage für den gewählten Anbieter
 * (z. B. IDnow AutoIdent, Nect, POSTIDENT). Endpunkt und Feldnamen beim
 * Anschluss an die echte Sandbox anpassen – Vertrag + AVV vorher (Team).
 */
function restAdapter(provider: string, apiKey: string, baseUrl: string): IdentAdapter {
  return {
    name: provider,
    async createSession(profileId, callbackUrl) {
      const response = await fetch(`${baseUrl}/sessions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        // Nur eine opake Referenz – niemals Profildaten an den Anbieter.
        body: JSON.stringify({ reference: profileId, redirect_url: callbackUrl }),
      });
      if (!response.ok) {
        throw new Error(`Ident-Anbieter antwortete mit ${response.status}`);
      }
      const session = await response.json();
      return {
        providerSessionId: String(session.id),
        redirectUrl: String(session.redirect_url),
      };
    },
  };
}

export function getIdentAdapter(): IdentAdapter {
  const provider = Deno.env.get("IDENT_PROVIDER") ?? "mock";
  if (provider === "mock") return mockAdapter;

  const apiKey = Deno.env.get("IDENT_API_KEY");
  const baseUrl = Deno.env.get("IDENT_API_BASE_URL");
  if (!apiKey || !baseUrl) {
    throw new Error("IDENT_API_KEY/IDENT_API_BASE_URL fehlen für den konfigurierten Anbieter.");
  }
  return restAdapter(provider, apiKey, baseUrl);
}
