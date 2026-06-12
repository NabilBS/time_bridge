# Zeitbrücke – Arbeitsregeln

Zeitbrücke ist eine Mobile-App, die Senioren („Zeit schenken") und Familien („Unterstützung suchen") im Berliner Kiez zusammenbringt.

## Monorepo

- pnpm-Workspace: `apps/mobile` (Expo-App), `packages/shared` (Vertrag), `supabase/` (DB-Schema)
- `pnpm typecheck` muss vor jedem Commit grün sein.

## Der Vertrag (Contract)

`packages/shared` (Zod-Schemas `ProfileSchema`, `FamilyDetailsSchema`, `AvailabilitySchema`, Konstanten `BERLIN_DISTRICTS`, `INTEREST_SUGGESTIONS`, `TIME_SLOTS`) und `supabase/migrations/` definieren das Datenmodell. **Keine Änderung an `packages/shared` oder `supabase/` ohne explizite Freigabe.** Neue Dependencies in der App sind erlaubt, Contract-Änderungen nicht.

## Produktregeln

- Zielgruppe 60+: Touch-Ziele ≥ 48 pt, Basis-Schrift ≥ 17 pt, ein Schritt pro Screen, Sie-Form durchgängig.
- Alle UI-Texte und Fehlermeldungen auf Deutsch, konkret und freundlich.
- Datenschutz: Es werden **nie** Kindernamen, -fotos oder -geburtsdaten erfasst – das Schema gibt es nicht her, und die UI darf es auch nicht suggerieren.
- Design ausschließlich über Tokens aus `apps/mobile/lib/theme.ts` – keine hartkodierten Farben/Größen in Screens.

## Aufträge

Aufträge liegen unter `tasks/` (z. B. `tasks/001-onboarding.md`) und enthalten Ziel, Datenmapping und Akzeptanzkriterien. App-spezifische Konventionen: `apps/mobile/CLAUDE.md`.
