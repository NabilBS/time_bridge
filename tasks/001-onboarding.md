# Auftrag 001 – Auth & Onboarding (Mobile-Agent)

*Ablage im Repo unter `tasks/001-onboarding.md`. Start:*

```bash
git worktree add ../zb-mobile-onboarding -b feat/mobile-onboarding
cd ../zb-mobile-onboarding && claude
# Prompt: "Lies CLAUDE.md, apps/mobile/CLAUDE.md und tasks/001-onboarding.md und setze Auftrag 001 um."
```

---

## Ziel

Ein neuer Nutzer kann sich per Magic Link anmelden, seine Rolle wählen und in unter 5 Minuten ein vollständiges Profil anlegen. Danach landet er im Tab-Bereich. Der bestehende Vertrag (`packages/shared`, `supabase/migrations/0001_init.sql`) deckt alles ab – **keine Contract-Änderung nötig oder erlaubt.**

## Flow & Datenmapping

Ein Schritt pro Screen (Zielgruppe 60+), Fortschrittsanzeige „Schritt X von Y", Zurück immer möglich.

| # | Screen | Eingaben → Ziel im Vertrag |
|---|---|---|
| 0 | **Willkommen** | Nur Text + ein Button. Copy: Titel „Zeit, die verbindet." Subtext: „Zeitbrücke bringt Senioren und Familien im Kiez zusammen – sicher, geprüft und auf Augenhöhe." Button: „Los geht's" |
| 1 | **Anmelden** | E-Mail → `supabase.auth.signInWithOtp` (Magic Link). Hinweis-Screen „Wir haben Ihnen einen Anmelde-Link an … geschickt. Bitte öffnen Sie die E-Mail auf diesem Gerät." |
| 2 | **Rollenwahl** | Zwei große Karten: „Ich möchte Zeit schenken" → `profiles.role = 'senior'` · „Wir suchen Unterstützung" → `'family'` |
| 3 | **Basisdaten** | Anzeigename (Vorname + Initial empfehlen, z. B. „Helga R.") → `display_name`; Geburtsjahr (Picker) → `birth_year` |
| 4a | **Senior: Interessen** | Chips aus Startliste (Vorlesen, Hausaufgaben, Backen, Werken, Spielplatz, Gesellschaftsspiele, Musik, Sprachen, Sport, Natur) + Freitext → `interests[]` (min. 1) |
| 4b | **Familie: Kinder** | Anzahl (Stepper 1–10) → `children_count`; Altersspanne (zwei Picker 0–17) → `age_min`/`age_max`. Pflicht-Hinweis im UI: „Wir fragen bewusst keine Namen oder Fotos Ihrer Kinder ab." |
| 5a | **Senior: Verfügbarkeit** | Wochentag-Raster (Mo–So) × Zeitfenster (Vormittag 9–12, Nachmittag 14–18, früher Abend 17–20) → je Auswahl eine Zeile in `availabilities` (weekday 0–6, time_from/time_to) |
| 5b | **Familie: Wunsch** | Freitext (max. 600) „Wobei wünschen Sie sich Unterstützung?" → `care_wishes` |
| 6 | **Kiez** | Bezirk (Picker aus `BERLIN_DISTRICTS`) → `district`; PLZ (5 Ziffern) → `postal_code`; optional Kurzvorstellung → `bio` |
| 7 | **Fertig** | Zusammenfassung + Schreiben in DB. CTA: „Profil ansehen und Vertrauensstufe 1 starten" → Profil-Tab. Copy: „Geschafft! Mit jeder Vertrauensstufe wird Ihr Profil sichtbarer." |

Schreiben in DB als zusammenhängender Abschluss in Schritt 7 (ein `profiles`-Insert mit `id = auth.uid()`, dann `family_details` bzw. `availabilities`). Vorher alle Eingaben lokal im Onboarding-State halten und mit den Zod-Schemas aus `@zeitbruecke/shared` validieren (`ProfileSchema`, `FamilyDetailsSchema`).

## Technische Vorgaben

1. **Session-Persistenz:** `@react-native-async-storage/async-storage` hinzufügen und im Supabase-Client als `auth.storage` setzen (erlaubte Dependency-Ergänzung, keine Contract-Änderung).
2. **Deep Link:** Magic-Link-Redirect auf `zeitbruecke://auth/callback` (Scheme steht in `app.json`); `expo-linking` für das Token-Handling, Doku: Supabase „Native Mobile Deep Linking".
3. **Routing-Logik beim App-Start:** keine Session → `/onboarding/welcome` · Session, aber kein `profiles`-Eintrag → Onboarding ab Schritt 2 fortsetzen (Eingaben aus lokalem State wiederherstellen) · Session + Profil → `/(tabs)`.
4. **Demo-Modus** (`isDemo === true`): kompletter Flow durchspielbar, Schritt 7 schreibt nur in lokalen State, Banner „Demo – Daten werden nicht gespeichert". Kein Crash ohne Env.
5. **Fehlerpfade deutsch und konkret:** „Diese E-Mail-Adresse scheint ungültig zu sein.", „Keine Verbindung – Ihre Eingaben sind gespeichert, bitte versuchen Sie es gleich erneut."
6. **Struktur:** Screens unter `app/onboarding/`, Onboarding-State als ein Context/Reducer in `lib/onboarding.ts`. Design ausschließlich über Tokens aus `lib/theme.ts`; Touch-Ziele ≥ 48 pt, Basis-Schrift ≥ 17 pt, Sie-Form durchgängig.

## Akzeptanzkriterien (Definition of Done)

- [ ] Neuer Nutzer: Welcome → fertiges Profil in < 5 Minuten, beide Rollenpfade
- [ ] App-Kill mitten im Onboarding → Neustart setzt am richtigen Schritt mit erhaltenen Eingaben fort
- [ ] Validierung: `age_max ≥ age_min`, PLZ-Regex, min. 1 Interesse (Senior) – Fehlermeldungen am Feld, nicht als Alert
- [ ] Demo-Modus vollständig durchspielbar ohne Backend
- [ ] Nirgendwo werden Kindernamen, -fotos oder -geburtsdaten erfasst (Schema gibt es nicht her – UI darf es auch nicht suggerieren)
- [ ] `pnpm typecheck` grün; keine Änderung an `packages/shared` oder `supabase/`
- [ ] `qa-reviewer` und `security-reviewer` ohne Blocker; PR gegen `main` mit Screenshots beider Pfade

## Nicht im Scope

Verifizierungs-Upload (Auftrag 002), Foto-Upload, Push-Notifications, Anfragen/Chat, Web.
