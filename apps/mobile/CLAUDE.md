# apps/mobile – Konventionen

Expo-App (expo-router, TypeScript strict). Einstieg: `pnpm start` in diesem Verzeichnis.

## Struktur

- `app/` – Routen (expo-router). Onboarding unter `app/onboarding/`, Tabs unter `app/(tabs)/`, Auth-Callback unter `app/auth/callback.tsx`, Verifizierung unter `app/verifizierung/` (Detail `[type].tsx`, Upload `upload/[type].tsx`).
- `lib/theme.ts` – **einzige** Quelle für Farben, Abstände, Schriftgrößen, Radien. Keine hartkodierten Werte in Screens.
- `lib/supabase.ts` – Supabase-Client (AsyncStorage als `auth.storage`) und `isDemo`-Flag.
- `lib/onboarding.ts` – Onboarding-State als Context + Reducer, persistiert in AsyncStorage (App-Kill-sicher).
- `lib/verifications.ts` – Nachweise laden/einreichen (real + Demo), Datei-Validierung (10 MB, JPG/PNG/HEIC/PDF), Pfad-Konvention `verificationDocPath` aus `@zeitbruecke/shared`. `trust_level` schreibt nie die App – das macht der DB-Trigger.
- `lib/meetings.ts` – Treffen & Bewertungen (real + Demo): Partner-Orte laden, Treffen anlegen (erstes Treffen erzwingt verifizierten Partner-Ort – die DB prüft zusätzlich), absagen/abschließen, bewerten, Aggregat via `review_stats`. Routen: `app/treffen/planen/[matchId]`, `app/treffen/bewerten/[meetingId]`.
- `lib/notifications.ts` – Push-Lebenszyklus (real + Demo): Erlaubnis + Expo-Token-Upsert in `push_tokens`, Token-Löschung beim Logout, `notification_prefs` lesen/schreiben, Deep-Link-Mapping, Vordergrund-Banner-Unterdrückung im offenen Chat (`setActiveChat`). Screens: `app/benachrichtigungen/erlaubnis` (Opt-in vor System-Dialog), `app/einstellungen/benachrichtigungen` (Schalter je Kategorie). Deep Links über `components/NotificationDeepLinks` (Hintergrund + Kaltstart).
- `lib/matching.ts` – Entdecken/Anfragen/Matches/Chat/Melden (real + Demo).
- `components/Avatar.tsx` – Foto (public URL aus `avatars`) oder Initialen-Kreis in Fichte; eigene Ansicht mit Schleier bei `submitted`. Eingebaut in Entdecken, Profildetail, Chat-Liste, Anfragen, Profil-Tab.
- `lib/photos.ts` – Profilfoto (Auftrag 009): Neukodierung über `expo-image-manipulator` (Resize 1024 px, JPEG) entfernt **pflichtgemäß** alle EXIF-/GPS-Metadaten; Upload nach `avatars-pending/{uid}/…`, Insert `photo_submissions`. Nutzer können `profiles.photo_path` nie selbst setzen (Spalten-Grants). Screen: `app/profil-foto.tsx` (Regeln: nur Sie im Bild, keine Kinder).
- `lib/ident.ts` – Video-Ident (Auftrag 010): Start über Edge Function `EDGE_IDENT_START` → Redirect-URL in `expo-web-browser`, Rückkehr über `zeitbruecke://ident/callback` (`app/ident/callback.tsx`); Demo simuliert den Abschluss nach 3 s. Der persönliche Video-Termin bleibt gleichberechtigt sichtbar (Barrierefreiheit).
- `lib/surveys.ts` – Kurzbefragung (Auftrag 008): Trigger erst nach dem **zweiten** abgeschlossenen Treffen, danach frühestens alle 60 Tage (lokal gedrosselt, DB-Unique als Obergrenze). Screen: `app/befragung.tsx` – „Überspringen" ist gleichwertig gestaltet (kein Dark Pattern).
- `lib/sentry.ts` – Crash-Monitoring nur in Production-Builds (`EXPO_PUBLIC_SENTRY_DSN`); `beforeSend` entfernt E-Mails/Dokumentpfade/Nutzer, `sendDefaultPii` aus. Niemals Nachrichteninhalte in Events.
- `app/einstellungen/` – Benachrichtigungen, Rechtliches (Env-URLs via `expo-web-browser`), App-Version, Abmelden, **Konto löschen** (`konto-loeschen.tsx`: Bestätigung durch Tippen von „LÖSCHEN", dann RPC `delete_account`; Demo simuliert nur).
- Onboarding-Anmeldung: Pflicht-Checkbox AGB/Datenschutz vor dem Magic-Link-Versand; Geburtsjahr-Picker endet bei `BIRTH_YEAR_MAX` (2008 – nur Erwachsene). Annahme einer Anfrage läuft NUR über `supabase.rpc(RPC_ACCEPT_REQUEST, …)`, nie per Update. Chat nutzt Realtime (`postgres_changes` auf `messages`, RLS-gefiltert) und optimistisches Senden mit Rollback. Routen: Tabs Entdecken/Anfragen/Chats/Profil, `app/profil-detail/[id]`, `app/chat/[matchId]`, `app/melden/[profileId]`.
- `components/` – wiederverwendbare UI-Bausteine (Buttons, Chips, ProgressHeader, …).

## Regeln

- Zielgruppe 60+: Touch-Ziele ≥ 48 pt (`theme.touchTarget`), Basis-Schrift ≥ 17 pt, ein Schritt pro Screen, Sie-Form.
- Fehlermeldungen deutsch, konkret, **am Feld** (nicht als Alert).
- Eingaben mit den Zod-Schemas aus `@zeitbruecke/shared` validieren – keine eigenen Schema-Kopien.
- Demo-Modus (`isDemo === true`): kompletter Flow ohne Backend durchspielbar, kein Crash ohne Env.
- Deep Link für Magic Link: `zeitbruecke://auth/callback` (Scheme in `app.json`).

## Routing beim App-Start (`app/index.tsx`)

1. Keine Session → `/onboarding/welcome`
2. Session, aber kein `profiles`-Eintrag → Onboarding am gespeicherten Schritt fortsetzen (ab Schritt 2)
3. Session + Profil → `/(tabs)`
