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
