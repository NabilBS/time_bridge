# Auftrag 010 – Video-Ident-Integration: Stufe 1 automatisieren (Backend-Agent + Mobile-Agent)

*Ablage im Repo unter `tasks/010-video-ident.md`. Voraussetzung: 002 und 007 gemerged (Migration 0010 nach 0009). Roadmap-Bezug: „Verifizierung teilautomatisiert" (Fördermonat 7–12). Bis dahin bleibt der manuelle Video-Termin aus 002 der Weg – dieser Auftrag ersetzt ihn nicht, er ergänzt ihn.*

```bash
git worktree add ../zb-backend-ident -b feat/backend-ident
git worktree add ../zb-mobile-ident  -b feat/mobile-ident
# in jedem Ordner: claude
# Prompt: "Lies CLAUDE.md, dein Bereichs-CLAUDE.md und tasks/010-video-ident.md und setze dein Teilpaket um."
```

---

## Ziel

Ein Nutzer durchläuft die Identitätsprüfung (Stufe 1) digital bei einem externen Ident-Anbieter; das Ergebnis kommt per Webhook zurück und hebt die Vertrauensstufe **automatisch**. Architektur ist anbieterneutral (dünner Adapter), damit der Anbieterwechsel keine App-Änderung kostet.

## Anbieter-Entscheidung (Team, vor Implementierung)

Wir unterliegen **nicht** dem Geldwäschegesetz – ein vollwertiges VideoIdent (5–15 €/Prüfung) ist nicht nötig, ein automatisiertes Selfie-Ident (1–3 €) genügt für „Identität bestätigt". Kriterien-Tabelle für die Auswahl (z. B. IDnow AutoIdent, Nect, POSTIDENT): Preis/Prüfung · EU-Hosting + AVV · Redirect-Flow statt SDK-Zwang (weniger App-Abhängigkeiten) · Abbruchquote bei Zielgruppe 60+ (Referenzen erfragen, Nect wird z. B. von Krankenkassen eingesetzt) · Sandbox verfügbar. ⚠️ Vertrag + AVV vor Anbindung; Budget steht im Businessplan (Verifizierungskosten).

## Vertragsergänzung (vom Orchestrator freigegeben – exakt so übernehmen)

In `packages/shared/src/types.ts` ergänzen:

```ts
export const IdentSessionStatus = z.enum(["created", "completed", "failed", "expired"]);
export type IdentSessionStatus = z.infer<typeof IdentSessionStatus>;

export const IdentSessionSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  provider: z.string(),
  status: IdentSessionStatus,
  created_at: z.string(),
  completed_at: z.string().nullable(),
});
export type IdentSession = z.infer<typeof IdentSessionSchema>;

/** Edge-Function-Namen – Aufruf nur über diese Konstanten. */
export const EDGE_IDENT_START = "ident-start";
```

Neue Env-Variablen (`.env.example`): `IDENT_PROVIDER`, `IDENT_API_KEY`, `IDENT_WEBHOOK_SECRET` (nur Edge Functions, nie Client).

## Teil A – Backend-Agent (Migration `0010_ident.sql` + zwei Edge Functions)

1. **Tabelle `ident_sessions`** gemäß Vertrag + `provider_session_id text` (interne Referenz, **nicht** im Shared-Schema – der Client braucht sie nie). RLS: Select nur eigene Zeilen; Insert/Update nur Service-Role. Partieller Unique-Index: eine offene Session je Profil.
2. **Edge Function `ident-start`** (auth-pflichtig): prüft, dass noch kein `video_ident` mit `approved` existiert → legt Anbieter-Session per Server-API an → speichert `ident_sessions`-Zeile → gibt **nur** die Redirect-URL zurück.
3. **Edge Function `ident-webhook`** (öffentlich erreichbar, aber abgesichert):
   - **Signaturprüfung gegen `IDENT_WEBHOOK_SECRET` ist die erste Zeile** – ungültige Signatur → 401, kein Logging des Bodys
   - Idempotent: dieselbe Anbieter-Session wird nur einmal verarbeitet
   - Erfolg → `ident_sessions.status = 'completed'` + Upsert `verifications` (`type = 'video_ident'`, `status = 'approved'`) → der Trigger aus 0001 hebt die Stufe; Misserfolg → `failed` + `verifications.status = 'rejected'` mit neutraler `review_note` („Identifizierung nicht abgeschlossen – Sie können es erneut versuchen oder einen Video-Termin buchen.")
4. **Datenminimierung als Architektur:** Wir speichern ausschließlich bestanden/nicht bestanden + Anbieter-Referenz-ID. **Keine** Ausweisdaten, kein Geburtsdatum, kein Selfie, keine Dokumentbilder – weder in DB noch in Logs. Die Identitätsdaten liegen beim Anbieter (AVV); Abruf nur im Eskalationsfall über definierten Prozess. Eintrag in `docs/offene-rechtsfragen.md`: Rechtsgrundlage des Eskalationsabrufs, Aufbewahrungsfristen beim Anbieter.
5. **Aufräum-Job:** pg_cron setzt `created`-Sessions älter als 24 h auf `expired`.

## Teil B – Mobile-Agent

1. **Stufe-1-Screen umbauen** (ersetzt den reinen Buchungs-CTA aus 002): Primärweg „Jetzt online identifizieren (ca. 5 Minuten)" → Aufruf `EDGE_IDENT_START` → Redirect-URL in `expo-web-browser` öffnen → Rückkehr über Deep Link `zeitbruecke://ident/callback` → Status per Pull-to-Refresh/Polling aktualisieren.
2. **Der manuelle Weg bleibt gleichberechtigt sichtbar:** „Lieber im persönlichen Video-Gespräch? Termin vereinbaren" (Link aus 002). Für die Zielgruppe 60–80 ist das keine Notlösung, sondern Barrierefreiheit – niemand scheitert an einem Selfie-Flow.
3. **Status-UI:** laufende Session = „Identifizierung läuft – das Ergebnis kommt in wenigen Minuten" · `completed` = Badge springt (Pull-to-Refresh) · `failed` = Begründung + beide Wege erneut anbieten.
4. **Vor dem Absprung ein Erwartungs-Screen:** was der Anbieter ist, was er sieht (Ausweis + Gesicht), was Zeitbrücke davon speichert („nur das Ergebnis: geprüft ja/nein") – derselbe ehrliche Ton wie beim Führungszeugnis.
5. **Demo-Modus:** simulierte Session mit Statuswechsel nach 3 s.

## Akzeptanzkriterien (Definition of Done)

- [ ] Webhook-Negativtests dokumentiert: falsche Signatur → 401 ohne Verarbeitung; doppelter Callback → keine zweite Verarbeitung; Callback für fremde/unbekannte Session → folgenlos
- [ ] Erfolgs-Durchlauf (Anbieter-Sandbox): Start in der App → Redirect → Webhook → `trust_level` steigt ohne App-Code, Badge nach Refresh sichtbar
- [ ] Datenprüfung im PR: weder DB-Dump noch Function-Logs enthalten Ausweisdaten, Geburtsdaten oder Bilddaten
- [ ] Doppelstart verhindert (offene Session blockiert zweite; abgelaufene Session nach Cron erneut möglich)
- [ ] Manueller Video-Termin-Weg weiterhin funktionsfähig und sichtbar
- [ ] Demo-Modus vollständig; `pnpm typecheck` grün; Vertragsänderung exakt wie freigegeben
- [ ] `qa-reviewer` und `security-reviewer` ohne Blocker

## Nicht im Scope

Anbieter-Vertragsverhandlung und AVV (Team + Anwalt), Abgleich des Klarnamens mit `display_name` (bewusst nicht – Anzeigename bleibt „Vorname + Initial"), Ident für Familien als Pflicht (bleibt optional, Senioren zuerst), Wiederverwendung der Ident-Daten für andere Zwecke (ausgeschlossen per Datenminimierung).
