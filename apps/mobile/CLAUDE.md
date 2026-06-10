# apps/mobile – Konventionen

Expo-App (expo-router, TypeScript strict). Einstieg: `pnpm start` in diesem Verzeichnis.

## Struktur

- `app/` – Routen (expo-router). Onboarding unter `app/onboarding/`, Tabs unter `app/(tabs)/`, Auth-Callback unter `app/auth/callback.tsx`.
- `lib/theme.ts` – **einzige** Quelle für Farben, Abstände, Schriftgrößen, Radien. Keine hartkodierten Werte in Screens.
- `lib/supabase.ts` – Supabase-Client (AsyncStorage als `auth.storage`) und `isDemo`-Flag.
- `lib/onboarding.ts` – Onboarding-State als Context + Reducer, persistiert in AsyncStorage (App-Kill-sicher).
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
