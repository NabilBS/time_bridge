# supabase/ – Schema und Prüfprozess

Migrationen sind Teil des Vertrags – Änderungen nur per expliziter Freigabe. Einspielen mit `supabase db push`, frischer Aufbau mit `supabase db reset`.

## Vertrauensstufen

`profiles.trust_level` wird **nur** vom Trigger `verifications_recompute_trust_level` geschrieben (App-Code nie):

- Stufe 1: registriert
- Stufe 2: `video_ident` mit Status `approved`
- Stufe 3: zusätzlich `background_check` mit Status `approved`

Läuft eine Freigabe ab (`valid_until < current_date`), setzt der tägliche pg_cron-Job `expire-verifications` (03:15 Uhr) den Status auf `expired` – der Trigger senkt die Stufe dann automatisch.

## Prüfprozess (Pilot, manuell via Supabase Studio)

1. Eingereichte Nachweise: Tabelle `verifications`, Zeilen mit `status = 'submitted'`.
2. Dokument ansehen: Bucket `verification-docs`, Pfad steht in `document_path` (signierte URL max. 60 s).
3. Entscheidung: Zeile auf `approved` oder `rejected` setzen.
4. **Bei `background_check` zusätzlich:**
   - `valid_until` = Ausstellungsdatum + 3 Jahre eintragen.
   - **Die Datei im Bucket löschen und `document_path` auf `null` setzen** (Löschregel/Datenminimierung: gespeichert bleibt nur „geprüft, gültig bis"). Dabei auch verwaiste Dateien desselben Nutzers ohne zugehörige `submitted`-Zeile entfernen.

## Datenschutz-Regeln

- `verification-docs` ist niemals öffentlich; signierte URLs max. 60 Sekunden.
- Kein OCR, keine Inhaltsauswertung, keine Logs mit Dokumentinhalten.
- Kein Upload von Personalausweis-Kopien irgendwo im Flow.
- Offene Rechtsfragen (BZRG/DSGVO): siehe `docs/offene-rechtsfragen.md`.

## Storage-Negativtest (gegen eine echte Instanz auszuführen)

Ziel: Nutzer B kann den Pfad von Nutzer A weder lesen noch beschreiben.

```sql
-- Als Nutzer B (JWT von B, z. B. via supabase-js mit B-Session):
-- 1. Lesen des fremden Pfads muss scheitern (leeres Ergebnis / 404):
--    storage.from('verification-docs').download('<uid-A>/<verification-id>.pdf')
-- 2. Schreiben in den fremden Pfad muss scheitern (RLS-Fehler 403):
--    storage.from('verification-docs').upload('<uid-A>/boese.pdf', ...)
-- 3. Schreiben in den eigenen Pfad muss gelingen:
--    storage.from('verification-docs').upload('<uid-B>/<verification-id>.pdf', ...)
```

Erwartung: (1) und (2) schlagen fehl, (3) gelingt. Ergebnis im PR dokumentieren, bevor der Prüfprozess startet.

## Matching-Negativtests (gegen eine echte Instanz auszuführen)

1. **Absender kann nicht selbst annehmen:** Als Absender `update match_requests set status = 'accepted' where id = …` → muss an RLS scheitern (0 Zeilen). Auch `accept_match_request(<id>)` als Absender → Exception „Nur die empfangende Person …".
2. **Dritter sieht/ändert fremde Anfragen nicht:** Als unbeteiligter Nutzer C `select`/`update` auf eine Anfrage zwischen A und B → leeres Ergebnis bzw. 0 Zeilen.
3. **Realtime respektiert RLS:** Nutzer C abonniert `postgres_changes` auf `messages` mit `match_id=eq.<Match von A/B>` → C darf beim Senden von A nach B **kein** Event erhalten.
4. **Gesperrtes Profil:** `is_active = false` beim Empfänger → neue Anfrage scheitert (Insert-Policy), `accept_match_request` wirft „Dieses Profil ist nicht mehr aktiv."

Ergebnisse im PR dokumentieren.

## Treffen & Bewertungen (Auftrag 005)

- **Ersttreffen-Pflicht:** Trigger `enforce_first_meeting_location` verlangt beim ersten `meetings`-Insert eines Matches (kein vorhandenes planned/completed) eine gesetzte, **verifizierte** `partner_location_id`. Folgetreffen sind frei.
- **Bewertungen:** `review_write` erlaubt Insert nur für Match-Mitglieder und nur bei `status = 'completed'`; genau eine Bewertung je Person und Treffen (Unique-Index). `review_read` nur für Match-Mitglieder – Einzelkommentare sind nicht öffentlich.
- **Aggregate:** ausschließlich über `review_stats(p_profile)` (security definer), nie per Join.
- **Seed:** `supabase/seed.sql` legt 5 Platzhalter-Partner-Orte an (`supabase db reset` spielt sie ein).

### Negativtests Treffen/Bewertungen
1. Erstes Treffen ohne `partner_location_id` oder mit nicht-verifiziertem Ort → Insert wirft „Das erste Treffen findet an einem Partner-Ort statt."; Folgetreffen ohne Ort → erlaubt.
2. Bewertung durch Dritte oder vor `completed` → RLS lehnt ab; zweite Bewertung derselben Person → Unique-Verletzung.
3. `review_stats` liefert korrektes Aggregat; Einzelkommentare fremder Matches sind via `select` nicht abrufbar.

## Benachrichtigungen (Auftrag 006)

- **Outbox:** `notification_outbox` ist rein intern (RLS aktiv, keine Policy ⇒ nur Service-Role). Trigger befüllen sie mit **nur IDs + Anzeigename**, nie Nachrichtentext/Dokumentdaten. Opt-out je Kategorie (`notification_prefs`) verhindert den Eintrag bereits im Trigger (`notif_enabled`).
- **Treffen-Erinnerung:** stündlicher pg_cron-Job, 23–24 h vor `scheduled_at`, dedupliziert über Unique-Index `(recipient_id, payload->>'meeting_id')`.
- **Edge Function `process-outbox`:** per Cron-Trigger jede Minute. Claim über `claim_outbox_batch` (`for update skip locked` ⇒ kein Doppelversand bei parallelen Läufen), Expo Push API, `sent_at` setzen, bei Fehler `attempts + 1`, ab 5 Versuchen verworfen; `DeviceNotRegistered` → Token löschen.
  - Deploy: `supabase functions deploy process-outbox`; Cron-Trigger (z. B. via `pg_cron` + `net.http_post` oder Dashboard-Schedule) jede Minute auf die Function-URL.
- **Payload-Inspektion:** `select kind, payload from notification_outbox` enthält nie `body`/Dokumentinhalte.

### RLS-Negativtest Benachrichtigungen
Nutzer B darf weder `push_tokens` noch `notification_outbox`-Zeilen von Nutzer A sehen: `select` als B auf fremde Zeilen → leer (Outbox: gar keine Policy, push_tokens: nur eigene).

## Konto-Löschung (Auftrag 007)

- Läuft NUR über die RPC `delete_account()` (security definer, ohne Parameter – löscht immer `auth.uid()`): erst Storage-Objekte (`verification-docs/{uid}/*`, `avatars/{uid}/*`), dann `auth.users` → Kaskade räumt `profiles` und alles Abhängige (Matches, Nachrichten, Treffen, Bewertungen, Tokens, Outbox, Surveys). Schlägt die Storage-Löschung fehl, bricht die Function ab (keine halben Zustände).
- FK-Reparatur in 0007: `verifications.reviewed_by` → `on delete set null`, `matches.request_id` → `on delete set null`; alle übrigen Profil-FKs kaskadierten bereits (0001/0005).
- Hinweis: `delete from storage.objects` entfernt die Objektzeilen; physische Dateireste im Objektspeicher räumt Supabase intern bzw. ein periodischer Cleanup – im Piloten akzeptiert, im PR dokumentieren.
- Outbox-Hygiene: gelöschte Empfänger kaskadieren aus `notification_outbox`/`push_tokens`; `process-outbox` behandelt Empfänger ohne Tokens als zugestellt (kein Crash bei verwaisten Einträgen).
- Volljährigkeit: `profiles.birth_year <= 2008` (0007 verschärft den Check aus 0001; Shared-Konstante `BIRTH_YEAR_MAX` entsprechend 2008).

## Wirkungsmessung (Auftrag 008) – KPI ↔ BSS-Exposé

| View | Belegt |
|---|---|
| `kpi_profiles_weekly` | Wachstum: neue Profile je Woche/Rolle/Bezirk |
| `kpi_seniors_by_trust` | „50 verifizierte Senioren" (Stufe ≥ 2) |
| `kpi_funnel_weekly` | Kern-Loop: Anfragen → angenommen → Matches → Matches mit ≥ 1 Treffen |
| `kpi_meetings_weekly` | „100 zustande gekommene Treffen"; Kontrollmetrik Erst-Treffen an Partner-Orten (Soll: 100 % – beweist Trigger aus 0005) |
| `kpi_retention` | Wiederkehrende Treffen (Matches mit ≥ 2 abgeschlossenen) – zentrale Wirkungs-KPI |
| `kpi_surveys_weekly` | NPS (Promotoren − Detraktoren), Einsamkeits-/Entlastungswerte |

- **Nur Aggregate:** Zellen mit n < 5 liefern `null` (kein Rückschluss auf Einzelpersonen in kleinen Bezirken). Views haben **keine Grants** für `authenticated`/`anon` – nur Service-Role liest (Web-Admin `/kennzahlen`).
- **Befragungs-Rhythmus:** Unique-Index auf `(profile_id, kind, period)`; `period` = generierte Spalte mit festen 60-Tage-Buckets seit Epoche (`floor(epoch/5184000)`). Grenzfall (zwei Antworten kurz vor/nach Bucket-Grenze) bewusst akzeptiert – die App drosselt zusätzlich lokal (frühestens alle 60 Tage, erst nach dem zweiten abgeschlossenen Treffen).
- Datenschutzerklärung: Befragungsdaten ergänzen → `docs/offene-rechtsfragen.md`.

### Negativtests Wirkungsmessung
1. Nutzer B liest keine Surveys von Nutzer A (`select` → leer).
2. `authenticated` kann keine `kpi_`-View abfragen (permission denied).
3. Zweite Antwort gleicher Art im selben 60-Tage-Bucket → Unique-Verletzung.
4. Mini-Datensatz (< 5 Zeilen je Zelle) → Views liefern `null` statt Zahlen.

## Profilfotos mit Moderation (Auftrag 009)

- **Kein Foto ohne Freigabe:** Einreichungen liegen im privaten Bucket `avatars-pending` (Pfad-Policies wie `verification-docs`); erst die Freigabe-Action im Web-Admin kopiert nach `avatars/{uid}/avatar.jpg`, setzt `profiles.photo_path`, löscht die Pending-Datei und setzt `status = 'approved'` – atomar, bei Fehler eines Schritts bricht alles ab.
- **Lücke geschlossen – Spalten-Grants auf `profiles`:** `authenticated` darf nur noch `display_name, birth_year, interests, district, postal_code, bio, notification_prefs` updaten (Insert: nur die Onboarding-Spalten). `photo_path`, `trust_level`, `role`, `is_active` sind für Nutzer unveränderlich; Trigger (security definer) und Service-Role sind nicht betroffen. Achtung App-Code: Upserts auf `profiles` brauchen `ignoreDuplicates` (ON CONFLICT DO UPDATE scheitert an den Grants).
- Eine offene Einreichung je Profil (partieller Unique-Index); Ablehnung löscht die Datei und schreibt die Begründung nach `review_note`.
- **EXIF-Pflicht (Mobile):** `expo-image-manipulator` kodiert jedes Foto neu (Resize 1024 px, JPEG) – entfernt alle Metadaten inkl. GPS. Nachweis (Vorher/Nachher-Dump z. B. mit `exiftool`) gehört in den PR.

### Negativtests Profilfotos
1. Eingereichtes, nicht freigegebenes Foto: für Nutzer B unter keiner URL abrufbar (privater Bucket, Pfad-Policy); Nutzer B liest keine fremden `photo_submissions`.
2. Direkter Update-Versuch auf `profiles.photo_path` durch den Nutzer → permission denied (Spalten-Grant).
3. Zweite offene Einreichung → Unique-Verletzung (UI fängt sie vorher ab).

## Video-Ident (Auftrag 010)

- **Architektur:** anbieterneutraler Adapter (`functions/_shared/ident-adapter.ts`; `IDENT_PROVIDER=mock` für Sandbox/Demo, REST-Vorlage für den echten Anbieter). Anbieter-Entscheidung samt Vertrag/AVV trifft das Team vor Anbindung (Kriterien in `tasks/010-video-ident.md`).
- **`ident-start`** (auth-pflichtig): blockt bei bereits bestätigtem `video_ident` oder offener Session, legt Anbieter-Session an, speichert `ident_sessions` und gibt nur die Redirect-URL zurück.
- **`ident-webhook`** (Deploy mit `--no-verify-jwt`): HMAC-SHA256-Signaturprüfung gegen `IDENT_WEBHOOK_SECRET` ist die erste Zeile (ungültig → 401, ohne Body-Logging); idempotent über Claim `status = 'created'`; Erfolg → Session `completed` + `verifications`-Insert `video_ident/approved` (Trigger aus 0001 hebt die Stufe), Misserfolg → `failed` + `rejected` mit neutraler Note.
- **Datenminimierung:** gespeichert wird nur bestanden/nicht bestanden + `provider_session_id`. Keine Ausweisdaten, kein Geburtsdatum, keine Bilddaten – weder in DB noch in Logs. Eskalationsabruf beim Anbieter: siehe `docs/offene-rechtsfragen.md`.
- pg_cron `expire-ident-sessions`: `created` älter als 24 h → `expired` (danach ist ein Neustart möglich).
- Secrets: `supabase/functions/.env.example` (`supabase secrets set`).

### Negativtests Video-Ident
1. Webhook mit falscher Signatur → 401, keine Verarbeitung, kein Body-Log.
2. Doppelter Callback derselben Anbieter-Session → zweiter Aufruf `processed: false`, keine zweite verifications-Zeile.
3. Callback für unbekannte/fremde Session → folgenlos.
4. Doppelstart: zweiter `ident-start` bei offener Session → 409; nach Cron-`expired` wieder möglich.
