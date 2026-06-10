# Auftrag 006 – Benachrichtigungen (Backend-Agent + Mobile-Agent)

*Ablage im Repo unter `tasks/006-benachrichtigungen.md`. Voraussetzung: Aufträge 004 und 005 gemerged (Migration 0006 nach 0005). Ohne Benachrichtigungen stirbt der Kern-Loop – niemand öffnet die App, um nachzusehen, ob eine Anfrage kam.*

```bash
git worktree add ../zb-backend-push -b feat/backend-notifications
git worktree add ../zb-mobile-push  -b feat/mobile-notifications
# in jedem Ordner: claude
# Prompt: "Lies CLAUDE.md, dein Bereichs-CLAUDE.md und tasks/006-benachrichtigungen.md und setze dein Teilpaket aus Auftrag 006 um."
```

---

## Ziel

Nutzer erfahren zuverlässig von neuen Anfragen, Annahmen, Nachrichten, Verifizierungs-Entscheidungen und anstehenden Treffen – per Push (Expo Push Service). **Datensparsamkeit gilt auch auf dem Sperrbildschirm:** Pushes nennen Absender und Anlass, nie Nachrichteninhalte.

## Vertragsergänzung (vom Orchestrator freigegeben – exakt so übernehmen)

In `packages/shared/src/types.ts` ergänzen:

```ts
export const NotificationKind = z.enum([
  "request_received",   // Neue Anfrage
  "request_accepted",   // Anfrage angenommen → Chat offen
  "message_received",   // Neue Nachricht (ohne Inhalt!)
  "verification_decided", // approved / rejected / expired
  "meeting_reminder",   // 24 h vor scheduled_at
]);
export type NotificationKind = z.infer<typeof NotificationKind>;

/** Schalter je Kategorie; fehlender Schlüssel = an. */
export const NotificationPrefsSchema = z.object({
  request_received: z.boolean().optional(),
  request_accepted: z.boolean().optional(),
  message_received: z.boolean().optional(),
  verification_decided: z.boolean().optional(),
  meeting_reminder: z.boolean().optional(),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefsSchema>;
```

## Teil A – Backend-Agent (Migration `0006_notifications.sql` + Edge Function)

1. **Tabelle `push_tokens`:** `profile_id` (FK, cascade), `expo_token text` (unique), `platform text` (`ios`/`android`), `created_at`. RLS: Insert/Select/Delete nur eigene Zeilen. Beim Logout löscht die App ihren Token.
2. **Spalte `profiles.notification_prefs jsonb not null default '{}'`** – Nutzer ändern sie über das bestehende `profiles_update_own`; keine neue Policy nötig.
3. **Outbox-Pattern – Tabelle `notification_outbox`:** `id`, `recipient_id`, `kind` (Enum wie im Vertrag), `payload jsonb` (nur IDs + Anzeigename des Auslösers, **nie** Nachrichtentext oder Dokumentdaten), `created_at`, `sent_at nullable`, `attempts int default 0`. Keine RLS-Leserechte für Nutzer (rein intern, Zugriff nur Service-Role).
4. **Trigger befüllen die Outbox:**
   - Insert `match_requests` → `request_received` an `to_profile`
   - Update auf `accepted` → `request_accepted` an `from_profile`
   - Insert `messages` → `message_received` an das andere Match-Mitglied
   - Update `verifications.status` auf `approved`/`rejected`/`expired` → `verification_decided` an den Betroffenen
   - Trigger prüfen `notification_prefs` des Empfängers und schreiben bei Opt-out gar nicht erst in die Outbox
5. **Treffen-Erinnerung:** pg_cron stündlich – `meetings` mit `status = 'planned'` und `scheduled_at` in 23–24 h → je ein `meeting_reminder` an beide Mitglieder (Duplikate über Unique-Index auf `(recipient_id, kind, (payload->>'meeting_id'))` verhindern).
6. **Edge Function `process-outbox`** (Deno, per Cron-Trigger jede Minute): liest ungesendete Einträge (Batch ≤ 100), holt Tokens des Empfängers, ruft die Expo Push API, setzt `sent_at`; bei Fehler `attempts + 1`, ab 5 Versuchen verwerfen und loggen (ohne personenbezogene Payload). `DeviceNotRegistered`-Antwort → Token löschen. Funktion ist idempotent (Claim per `update … where sent_at is null returning`).
7. **Deutsche Push-Texte zentral in der Function**, z. B.: `request_received` → Titel „Neue Anfrage", Text „{name} möchte Sie kennenlernen." · `message_received` → „Neue Nachricht von {name}" (ohne Inhalt) · `verification_decided/approved` → „Ihr Nachweis wurde geprüft – Ihre Vertrauensstufe ist gestiegen."

## Teil B – Mobile-Agent

1. **Erklär-Screen vor dem System-Dialog** (Opt-in-Quote!): nach erstem Login bzw. nach erstem Match ein eigener Screen – „Möchten Sie benachrichtigt werden, wenn jemand Ihnen schreibt?" mit „Ja, gern" → erst dann der iOS/Android-Permission-Dialog. Ablehnen ist folgenlos und später in den Einstellungen änderbar.
2. **Token-Lebenszyklus:** `expo-notifications` + `expo-device` (erlaubte Dependencies); nach Permission Token holen → Upsert in `push_tokens`; bei Logout eigenen Token löschen.
3. **Deep Links:** Tippen öffnet die richtige Stelle – `request_received` → Anfragen-Tab · `request_accepted`/`message_received` → `chat/[matchId]` · `verification_decided` → Profil-Tab · `meeting_reminder` → Chat mit Treffen-Karte. Kaltstart-Fall (App war beendet) gehört zum Test.
4. **Einstellungen:** Screen `app/einstellungen/benachrichtigungen.tsx` – ein Schalter je Kategorie (Labels deutsch), schreibt `notification_prefs`; Hinweis, wenn die System-Permission fehlt, mit Sprung in die OS-Einstellungen.
5. **Foreground-Verhalten:** App offen im betroffenen Chat → kein Banner (Realtime zeigt die Nachricht ohnehin); sonst dezentes In-App-Banner.
6. **Demo-Modus:** keine echten Pushes; Einstellungs-Screen funktioniert lokal, ein Demo-Hinweis erklärt das.
7. ⚠️ **Build-Hinweis dokumentieren (README):** Push funktioniert nicht in Expo Go – Test erfordert einen EAS Development Build auf echtem Gerät (`eas build --profile development`).

## Akzeptanzkriterien (Definition of Done)

- [ ] Jedes der fünf Ereignisse erzeugt genau einen Outbox-Eintrag und genau einen Push auf einem echten Gerät (Dev-Build); Screen-Recording im PR
- [ ] Payload-Inspektion dokumentiert: kein Nachrichtentext, keine Dokumentdaten in Outbox oder Push
- [ ] Opt-out je Kategorie wirkt (kein Outbox-Eintrag); abgemeldeter Token wird bei `DeviceNotRegistered` entfernt
- [ ] Doppelte Verarbeitung ausgeschlossen: zwei parallele Function-Läufe versenden nicht doppelt (Claim-Mechanik beschreiben)
- [ ] Deep Links funktionieren aus Hintergrund **und** Kaltstart
- [ ] RLS-Negativtest: Nutzer B sieht weder Tokens noch Outbox-Einträge von Nutzer A
- [ ] `pnpm typecheck` grün; Vertragsänderung exakt wie freigegeben; `qa-reviewer` und `security-reviewer` ohne Blocker

## Nicht im Scope

E-Mail-Benachrichtigungen (Anbieter-/AVV-Entscheidung steht aus), Badge-Zähler auf dem App-Icon, Bündelung mehrerer Nachrichten zu einem Push, Marketing-/Re-Engagement-Pushes (kommen, wenn überhaupt, nur mit eigener Einwilligung), Web-Push im Admin.
