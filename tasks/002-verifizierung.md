# Auftrag 002 – Verifizierungs-Upload (Backend-Agent + Mobile-Agent)

*Ablage im Repo unter `tasks/002-verifizierung.md`. Zwei Arbeitspakete, parallel möglich – der Vertrag unten fixiert alle Schnittstellen.*

```bash
git worktree add ../zb-backend-verif -b feat/backend-verification
git worktree add ../zb-mobile-verif  -b feat/mobile-verification
# in jedem Ordner: claude
# Prompt: "Lies CLAUDE.md, dein Bereichs-CLAUDE.md und tasks/002-verifizierung.md und setze dein Teilpaket aus Auftrag 002 um."
```

---

## Ziel

Ein Senior kann Nachweise einreichen und sieht jederzeit den Status. Nach Freigabe (vorerst manuell via Supabase Studio) springt die Vertrauensstufe **automatisch** – der Trigger aus `0001_init.sql` existiert bereits. Auftrag 002 baut den Weg dorthin: Storage, Regeln, Upload-UI.

## Vertragsergänzung (vom Orchestrator freigegeben – exakt so übernehmen)

In `packages/shared/src/types.ts` ergänzen (einzige erlaubte Änderung an `packages/shared`):

```ts
export const VerificationStatus = z.enum(["submitted", "approved", "rejected", "expired"]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const VerificationSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  type: VerificationType,
  status: VerificationStatus,
  document_path: z.string().nullable(),
  valid_until: z.string().nullable(),
  created_at: z.string(),
});
export type Verification = z.infer<typeof VerificationSchema>;

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  video_ident: "Video-Ident",
  background_check: "Erweitertes Führungszeugnis",
  first_aid_child: "Erste-Hilfe-am-Kind-Kurs",
  training_course: "Schulungsnachweis (z. B. VHS)",
  partner_reference: "Referenz eines Partner-Orts",
};

/** Pfad-Konvention im Bucket verification-docs – beide Agenten halten sich daran. */
export const verificationDocPath = (userId: string, verificationId: string, ext: string) =>
  `${userId}/${verificationId}.${ext}`;
```

## Teil A – Backend-Agent (Migration `0002_storage_verification.sql`)

1. **Buckets anlegen** (per Migration, nicht per Dashboard):
   - `verification-docs`: privat, `file_size_limit` 10 MB, `allowed_mime_types` = jpeg, png, heic, pdf
   - `avatars`: public-read, 5 MB, nur Bilder (UI dafür kommt später – Bucket jetzt mit anlegen)
2. **Storage-Policies** auf `storage.objects`:
   - `verification-docs`: INSERT nur, wenn der erste Pfadbestandteil `auth.uid()` ist; SELECT nur eigener Pfad; kein UPDATE/DELETE für Nutzer (Prüfung & Löschung laufen über Service-Role)
   - `avatars`: SELECT öffentlich, INSERT/UPDATE nur eigener Pfad
   - Negativtest gehört zum Paket: Zugriff auf fremden Pfad muss nachweislich scheitern
3. **Doppel-Einreichung verhindern:** partieller Unique-Index auf `verifications (profile_id, type) where status = 'submitted'`
4. **Wiedervorlage-Logik:** täglicher `pg_cron`-Job: `status = 'approved'` und `valid_until < current_date` → `'expired'`. Der bestehende Trigger senkt die Vertrauensstufe dann von selbst – das ist die im BSS-Exposé versprochene Ablauflogik.
5. **Dokumentieren in `supabase/CLAUDE.md`:** Prüfprozess (Pilot): Studio → Zeile auf `approved`/`rejected` setzen; bei `background_check` zusätzlich `valid_until` = Ausstellungsdatum + 3 Jahre eintragen und **die Datei im Bucket löschen + `document_path` auf null setzen** (Löschregel, siehe Datenschutz).

## Teil B – Mobile-Agent (`app/verifizierung/`)

1. **Einstieg:** Die statische Stufen-Liste in `app/(tabs)/profil.tsx` wird live – Status je `verification_type` aus der DB (bzw. Demo-State), Badge aktualisiert sich nach Pull-to-Refresh.
2. **Upload-Flow je Stufe** (nur für `role = 'senior'` sichtbar):
   - `first_aid_child` / `training_course`: Dokument wählen oder abfotografieren (`expo-document-picker` + `expo-image-picker`, erlaubte Dependencies) → Upload nach `verificationDocPath(...)` → Insert `verifications` mit `status = 'submitted'`
   - `background_check`: gleicher Flow, davor ein eigener Hinweis-Screen: was das erweiterte Führungszeugnis ist, wie man es beantragt (Bürgeramt/online, Hinweis „bei Einreichung nicht älter als 3 Monate"), und der Datenschutz-Satz: „Wir prüfen Ihr Dokument und löschen die Datei danach. Gespeichert bleibt nur: geprüft, gültig bis."
   - `video_ident`: im MVP kein Upload, sondern CTA „Video-Termin vereinbaren" (Konfig-Link, z. B. Cal.com – Platzhalter-Env `EXPO_PUBLIC_IDENT_BOOKING_URL`); Anbieter-Integration ist ein späterer Auftrag
   - `partner_reference`: reiner Info-Screen („Wird von Ihrem Partner-Ort bestätigt")
3. **Status-UI:** `submitted` = „Wird geprüft – Sie hören von uns" · `approved` = Stufe sichtbar im Badge · `rejected` = „Das hat leider nicht geklappt – bitte erneut einreichen" + Support-Mail · `expired` = „Bitte erneuern" mit Re-Upload
4. **Fehlerpfade:** Datei zu groß (>10 MB), falscher Typ, Abbruch, offline – deutsch und am Element, Eingaben gehen nicht verloren
5. **Demo-Modus:** kompletter Flow lokal; ein Demo-Knopf „Prüfung simulieren" setzt submitted → approved, damit der Badge-Sprung vorführbar ist (Banner wie gehabt)

## Datenschutz-Regeln (Blocker-Kriterien für den security-reviewer)

- `verification-docs` ist niemals öffentlich; keine signierten URLs mit langer Laufzeit (max. 60 s für die eigene Ansicht)
- Führungszeugnis = besonders sensibel: Datei wird nach Prüfung gelöscht, es bleiben nur Status + `valid_until` (Datenminimierung). Kein OCR, keine Inhaltsauswertung, keine Logs mit Dokumentinhalten
- Kein Upload von Personalausweis-Kopien irgendwo im Flow
- ⚠️ Im Repo-Root eine Datei `docs/offene-rechtsfragen.md` anlegen/ergänzen: BZRG-/DSGVO-Konformität des Führungszeugnis-Handlings (Einsichtnahme vs. Speicherung) ist vor Public Launch anwaltlich zu bestätigen – Pilotprozess ist auf Datenminimierung ausgelegt, ersetzt die Prüfung aber nicht

## Akzeptanzkriterien (Definition of Done)

- [ ] Migration läuft auf frischer DB durch (`supabase db reset`); Buckets + Policies + Cron vorhanden
- [ ] Storage-Negativtest dokumentiert: Nutzer B kann Pfad von Nutzer A weder lesen noch beschreiben
- [ ] Senior lädt Zertifikat hoch → Zeile `submitted`; nach `approved` (Studio) steigt `profiles.trust_level` ohne App-Code (Trigger-Beweis im PR beschreiben)
- [ ] `valid_until` in der Vergangenheit + Cron-Lauf → Status `expired`, Stufe sinkt
- [ ] Doppelte Einreichung desselben Typs wird verhindert (DB) und abgefangen (UI)
- [ ] Demo-Modus vollständig durchspielbar inkl. simulierter Prüfung
- [ ] `pnpm typecheck` grün; an `packages/shared` exakt die freigegebene Ergänzung, sonst nichts
- [ ] `qa-reviewer` und `security-reviewer` ohne Blocker; PRs mit Screenshots (Upload, Status, Badge-Sprung)

## Nicht im Scope

Prüf-UI im Web-Admin (Auftrag 003), echte Video-Ident-Anbieter-Integration, Avatar-Upload-UI, Benachrichtigungen bei Statuswechsel.
