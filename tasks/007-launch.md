# Auftrag 007 – Launch-Härtung & Store-Release (Backend-Agent + Mobile-Agent + devops)

*Ablage im Repo unter `tasks/007-launch.md`. Voraussetzung: 001–006 gemerged (Migration 0007 nach 0006). Ziel-Meilenstein: Closed Beta (TestFlight / Internal Track), danach Store-Freigabe.*

```bash
git worktree add ../zb-backend-launch -b feat/backend-launch
git worktree add ../zb-mobile-launch  -b feat/mobile-launch
# in jedem Ordner: claude
# Prompt: "Lies CLAUDE.md, dein Bereichs-CLAUDE.md und tasks/007-launch.md und setze dein Teilpaket aus Auftrag 007 um."
# devops-Subagent für eas.json, Sentry-Setup und Release-Workflow hinzuziehen.
```

---

## Ziel

Die App ist einreichbar und betreibbar: Konto-Löschung in der App (ohne sie lehnt Apple ab, Guideline 5.1.1), Rechtstexte erreichbar, Crash-Monitoring aktiv, Production-Builds reproduzierbar. **Dieser Auftrag schließt außerdem eine echte Lücke: Die heutigen Fremdschlüssel blockieren Konto-Löschungen.**

## Vertragsergänzung (vom Orchestrator freigegeben – exakt so übernehmen)

In `packages/shared/src/types.ts` ergänzen:

```ts
/** Konto-Löschung läuft NUR über diese RPC – nie über direkte Deletes. */
export const RPC_DELETE_ACCOUNT = "delete_account";
```

Neue Env-Variablen (in `.env.example` dokumentieren):

```
EXPO_PUBLIC_PRIVACY_URL=   # Datenschutzerklärung (vom Anwalt, gehostet)
EXPO_PUBLIC_TERMS_URL=     # AGB
EXPO_PUBLIC_IMPRINT_URL=   # Impressum
SENTRY_DSN=                # Sentry-Projekt, EU-Region
```

## Teil A – Backend-Agent (Migration `0007_account_deletion.sql` + Function)

1. **FK-Reparatur (Blocker für Löschung):** `messages.sender_id`, `reviews.reviewer_id`, `verifications.reviewed_by`, `reports.reporter_id`, `reports.reported_profile` haben kein `on delete`-Verhalten – eine Profil-Löschung schlägt heute fehl. Ändern: `messages.sender_id` und `reviews.reviewer_id` → `on delete cascade`; `verifications.reviewed_by` → `on delete set null`; `reports.*` → `on delete cascade` **plus** Eintrag in `docs/offene-rechtsfragen.md`: ob Missbrauchsmeldungen nach Konto-Löschung (anonymisiert) aufbewahrt werden dürfen/müssen, ist anwaltlich zu klären – bis dahin gilt vollständige Löschung.
2. **Volljährigkeit:** Check-Constraint `profiles.birth_year` auf `<= 2008` verschärfen (nur Erwachsene; UI aus 001 entsprechend anpassen lassen).
3. **RPC `delete_account()`** (`security definer`, transaktional, ohne Parameter – löscht immer nur `auth.uid()`):
   - Löscht zuerst alle Storage-Objekte des Nutzers (`verification-docs/{uid}/*`, `avatars/{uid}/*`)
   - Löscht dann `auth.users`-Zeile → Kaskade räumt `profiles` und alles Abhängige
   - Wirft sprechende Exception, falls Storage-Löschung fehlschlägt (keine halben Zustände)
   - `grant execute` an `authenticated`
4. **Push-Token-Hygiene:** Outbox-Trigger aus 006 dürfen bei gelöschten Empfängern nicht feuern (Kaskade erledigt Tokens; Function-Lauf mit verwaisten Einträgen darf nicht crashen – Test).

## Teil B – Mobile-Agent

1. **Einstellungen-Screen** `app/einstellungen/index.tsx`: Einträge Benachrichtigungen (aus 006), Rechtliches (Datenschutz, AGB, Impressum – öffnen via `expo-web-browser` aus den Env-URLs), App-Version, Abmelden, **Konto löschen**.
2. **Konto-Löschung:** eigener Bestätigungs-Screen – erklärt in zwei Sätzen, was gelöscht wird (Profil, Chats, Nachweise) und dass es endgültig ist; Bestätigung durch Tippen des Wortes „LÖSCHEN"; dann `supabase.rpc(RPC_DELETE_ACCOUNT)`, lokalen State + Push-Token räumen, zurück zum Welcome-Screen. Fehlerfall deutsch und ohne Datenverlust-Panik formuliert.
3. **Einwilligung im Onboarding nachrüsten (Ergänzung zu 001):** vor dem Magic-Link-Versand eine Pflicht-Checkbox „Ich akzeptiere die AGB und habe die Datenschutzerklärung gelesen" (verlinkt) + Hinweis „Zeitbrücke ist für Erwachsene (ab 18)." Geburtsjahr-Picker endet bei 2008.
4. **Sentry** (`@sentry/react-native` via `npx expo install`): nur in Production-Builds aktiv, `beforeSend` entfernt personenbezogene Daten – niemals Nachrichteninhalte, E-Mails oder Dokumentpfade in Events. `sendDefaultPii` bleibt aus.
5. **Demo-Modus:** Einstellungen vollständig bedienbar; Konto-Löschung simuliert nur den Flow.

## Teil C – devops-Subagent

1. **`eas.json`** mit Profilen `development` (Dev-Client, interne Verteilung), `preview` (TestFlight/Internal Track für die Closed Beta) und `production`; Versionierung über `autoIncrement`. Secrets (Sentry-DSN, Supabase-URL/Key) als EAS-Secrets, nicht im Repo.
2. **Release-Workflow:** `.github/workflows/release.yml` – auf Git-Tag `v*`: Typecheck, dann Hinweis-Job mit den manuellen EAS-Kommandos (Builds stößt das Team bewusst manuell an; kein Auto-Submit im Piloten).
3. **Store-Checkliste als `docs/store-release.md`:**
   - Apple: App-Privacy-Angaben (erhoben: E-Mail, grober Standort/Bezirk, Nutzungsdaten via Sentry – exakt aus dem Datenmodell ableiten, nichts beschönigen), Guideline 5.1.1 Konto-Löschung ✔, Alterskennzeichnung, Review-Notizen mit Demo-Zugang
   - Google: Data-Safety-Formular spiegelbildlich, Internal Track für Beta
   - Beide: deutsche Beschreibung in Markensprache (CI Abschnitt 07), Screenshots aus dem Demo-Modus, Support-Mail
   - ⚠️ Vor Public Launch: DSFA (Datenschutz-Folgenabschätzung) liegt vor – anwaltlich; Rechtstext-URLs sind live und nicht mehr Platzhalter

## Akzeptanzkriterien (Definition of Done)

- [ ] Konto mit Daten in allen Tabellen (Profil, Verifizierung, Match, Nachrichten, Treffen, Bewertung, Token) lässt sich vollständig löschen; Nachweis: Zeilen-Zählung vorher/nachher + leeres Storage-Listing im PR
- [ ] Gegenseite eines gelöschten Kontos: Chat zeigt „Dieses Profil ist nicht mehr aktiv.", App crasht nirgends
- [ ] Onboarding ohne akzeptierte Checkbox nicht fortsetzbar; Geburtsjahr > 2008 nicht wählbar
- [ ] Sentry empfängt Test-Crash aus Preview-Build; Event nachweislich ohne PII (Screenshot im PR)
- [ ] `eas build --profile preview` läuft für iOS und Android durch (Build-Links im PR)
- [ ] Rechtstexte öffnen aus den Einstellungen; Platzhalter-URLs klar als solche markiert
- [ ] `pnpm typecheck` grün; Vertragsänderung exakt wie freigegeben; `qa-reviewer` und `security-reviewer` ohne Blocker

## Nicht im Scope

Datenexport („Recht auf Datenübertragbarkeit" – Folgeauftrag nach Anwaltsgespräch), Konto-Deaktivierung als Alternative zur Löschung, In-App-Review-Prompts, Store-Submission selbst (macht das Team manuell), Web-Admin-Sentry.
