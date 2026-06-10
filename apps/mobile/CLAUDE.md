# apps/mobile – Konventionen

Expo-App (expo-router, TypeScript strict). Einstieg: `pnpm start` in diesem Verzeichnis.

## Struktur

- `app/` – Routen (expo-router). Onboarding unter `app/onboarding/`, Tabs unter `app/(tabs)/`, Auth-Callback unter `app/auth/callback.tsx`, Verifizierung unter `app/verifizierung/` (Detail `[type].tsx`, Upload `upload/[type].tsx`).
- `lib/theme.ts` – **einzige** Quelle für Farben, Abstände, Schriftgrößen, Radien. Keine hartkodierten Werte in Screens.
- `lib/supabase.ts` – Supabase-Client (AsyncStorage als `auth.storage`) und `isDemo`-Flag.
- `lib/onboarding.ts` – Onboarding-State als Context + Reducer, persistiert in AsyncStorage (App-Kill-sicher).
- `lib/verifications.ts` – Nachweise laden/einreichen (real + Demo), Datei-Validierung (10 MB, JPG/PNG/HEIC/PDF), Pfad-Konvention `verificationDocPath` aus `@zeitbruecke/shared`. `trust_level` schreibt nie die App – das macht der DB-Trigger.
- `lib/matching.ts` – Entdecken/Anfragen/Matches/Chat/Melden (real + Demo). Annahme einer Anfrage läuft NUR über `supabase.rpc(RPC_ACCEPT_REQUEST, …)`, nie per Update. Chat nutzt Realtime (`postgres_changes` auf `messages`, RLS-gefiltert) und optimistisches Senden mit Rollback. Routen: Tabs Entdecken/Anfragen/Chats/Profil, `app/profil-detail/[id]`, `app/chat/[matchId]`, `app/melden/[profileId]`.
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
