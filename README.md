# Zeitbrücke

> Zeit, die verbindet. Zeitbrücke bringt Senioren und Familien im Kiez zusammen – sicher, geprüft und auf Augenhöhe.

Senioren schenken Zeit (Vorlesen, Hausaufgaben, Backen, …), Familien finden Unterstützung in ihrer Nachbarschaft. Zielgruppe 60+: große Touch-Ziele, große Schrift, Sie-Form, ein Schritt pro Screen.

## Struktur

```
apps/mobile/          Expo-App (React Native, expo-router)
packages/shared/      Vertrag: Zod-Schemas, Konstanten (@zeitbruecke/shared)
supabase/migrations/  Datenbank-Schema (Postgres, RLS)
tasks/                Aufträge für Agenten/Entwickler
```

`packages/shared` und `supabase/` bilden den **Vertrag** zwischen App und Backend – Änderungen daran nur per expliziter Freigabe.

## Setup

Voraussetzungen: Node ≥ 20, pnpm ≥ 9.

```bash
pnpm install
pnpm typecheck

# App starten
cd apps/mobile
cp .env.example .env   # Supabase-Werte eintragen (optional, sonst Demo-Modus)
pnpm start
```

## Demo-Modus

Ohne `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` läuft die App im Demo-Modus: Der komplette Onboarding-Flow ist durchspielbar, es wird nichts gespeichert, ein Banner weist darauf hin. Die App crasht nie wegen fehlender Env-Variablen.

## Supabase

Migrationen liegen unter `supabase/migrations/` und werden mit der Supabase CLI eingespielt:

```bash
supabase db push
```

Auth läuft über Magic Link (`signInWithOtp`) mit Deep-Link-Redirect auf `zeitbruecke://auth/callback`.
