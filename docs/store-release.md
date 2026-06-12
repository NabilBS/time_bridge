# Store-Release-Checkliste (Closed Beta → Store-Freigabe)

Builds: `eas build --profile preview` (Beta) bzw. `--profile production`. Secrets (Supabase-URL/Anon-Key, `EXPO_PUBLIC_SENTRY_DSN`, Rechtstext-URLs) als EAS-Secrets pflegen – nichts davon ins Repo.

## Apple (App Store Connect)

- [ ] **App-Privacy-Angaben** – exakt aus dem Datenmodell abgeleitet, nichts beschönigen:
  - E-Mail-Adresse (Konto/Auth)
  - Grober Standort: Bezirk + PLZ (Profil; keine GPS-Daten)
  - Nutzungs-/Diagnosedaten via Sentry (Crash-Reports, ohne PII – `beforeSend` entfernt E-Mails/Dokumentpfade, `sendDefaultPii` aus)
  - Nutzerinhalte: Chat-Nachrichten, Profilangaben, Nachweise (Dokumente nur bis zur Prüfung, Führungszeugnis wird danach gelöscht)
- [ ] **Guideline 5.1.1 Konto-Löschung:** in-App unter Einstellungen → „Konto löschen" (RPC `delete_account`) ✔
- [ ] Alterskennzeichnung: 17+/18+ (App ist für Erwachsene; Onboarding erzwingt Geburtsjahr ≤ 2008)
- [ ] Review-Notizen: Demo-Zugang beschreiben (App ohne Env-Variablen bauen ⇒ Demo-Modus, kompletter Flow ohne Backend; alternativ Test-Konto auf Staging-Supabase)
- [ ] TestFlight: interne Gruppe für die Closed Beta

## Google (Play Console)

- [ ] **Data-Safety-Formular** spiegelbildlich zu den Apple-Angaben
- [ ] Internal Track für die Beta, danach Closed/Production
- [ ] Konto-Löschungs-URL im Formular: Verweis auf In-App-Löschung

## Beide Stores

- [ ] Deutsche Beschreibung in Markensprache (CI Abschnitt 07): warm, konkret, Sie-Form – „Zeit, die verbindet."
- [ ] Screenshots aus dem **Demo-Modus** (keine echten Nutzerdaten), beide Rollenpfade
- [ ] Support-Mail erreichbar (support@zeitbruecke.de) und im Store-Eintrag hinterlegt
- [ ] Rechtstext-URLs (`EXPO_PUBLIC_PRIVACY_URL`/`TERMS_URL`/`IMPRINT_URL`) sind **live und keine Platzhalter mehr**

## ⚠️ Vor Public Launch (Blocker)

- [ ] **DSFA (Datenschutz-Folgenabschätzung) liegt vor** – anwaltlich (siehe `docs/offene-rechtsfragen.md`)
- [ ] BZRG-/DSGVO-Freigabe fürs Führungszeugnis-Handling
- [ ] Sentry-Projekt in EU-Region; Test-Crash aus Preview-Build empfangen und Event auf PII geprüft
- [ ] Sentry-Sourcemaps: Config-Plugin `@sentry/react-native/expo` mit echter Org/Projekt beim EAS-Setup ergänzen (bewusst noch nicht im Repo, solange kein Sentry-Projekt existiert)
