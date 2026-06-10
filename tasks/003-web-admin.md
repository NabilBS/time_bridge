# Auftrag 003 – Web-Admin: Prüfen, Sperren, Partner-Orte (Web-Agent + Backend-Agent)

*Ablage im Repo unter `tasks/003-web-admin.md`. Hauptpaket beim Web-Agenten; der Backend-Agent liefert eine kleine Migration zu. Voraussetzung: Auftrag 002 ist gemerged.*

```bash
git worktree add ../zb-web-admin -b feat/web-admin
cd ../zb-web-admin && claude
# Prompt: "Lies CLAUDE.md, apps/web/CLAUDE.md und tasks/003-web-admin.md und setze Auftrag 003 um."
```

---

## Ziel

Das Team prüft Verifizierungen, bearbeitet Meldungen und pflegt Partner-Orte in einer internen Web-Oberfläche – statt in Supabase Studio. Die in Auftrag 002 dokumentierte **Löschregel fürs Führungszeugnis wird damit von einer Anweisung zu erzwungenem Code.**

## Vertragsergänzung (vom Orchestrator freigegeben – exakt so übernehmen)

1. **Migration `0003_review_note.sql`** (Backend-Agent): `alter table verifications add column review_note text;` – keine weiteren Änderungen. (Die bestehende RLS-Policy `verif_own` macht die Notiz automatisch nur für den Betroffenen sichtbar.)
2. **`packages/shared/src/types.ts`:** im `VerificationSchema` ergänzen: `review_note: z.string().nullable(),`

## Arbeitspaket Web-Agent (Next.js, App Router)

### Grundgerüst
- Next.js 15 + TypeScript strict + `@supabase/ssr`. Service-Role-Key **ausschließlich** in Server Actions / Route Handlern – ein Import in einer Client-Komponente ist ein Blocker.
- **Zugang:** Supabase-Magic-Link-Login + serverseitige Allowlist über Env `ADMIN_EMAILS` (kommagetrennt). Kein Treffer → 403-Seite. Middleware schützt alle Routen außer `/login`.
- Gestaltung: nüchtern und tabellenorientiert, aber mit CI-Tokens (Fichte/Gold/Papier, Atkinson Hyperlegible) – es ist dieselbe Marke.

### Seite 1: `/verifizierungen`
- Tabelle aller Zeilen mit `status = 'submitted'`, sortiert nach `created_at` (älteste zuerst), Filter nach `type`.
- Detailansicht je Einreichung: Profil-Basisdaten (Anzeigename, Rolle, Bezirk) + Dokument-Vorschau über **signierte URL mit max. 60 s Laufzeit**, serverseitig erzeugt. Kein Download-Link, keine URL im Client-State persistieren.
- Aktionen (Server Actions, jeweils mit Bestätigungsdialog):
  - **Freigeben:** `status = 'approved'`, `reviewed_by`, `reviewed_at` setzen. Bei `background_check` zusätzlich Pflichtfeld „Ausstellungsdatum" → `valid_until` = Ausstellungsdatum + 3 Jahre, dann **in derselben Action**: Datei im Bucket löschen + `document_path = null`. Die Action schlägt komplett fehl, wenn das Löschen fehlschlägt (keine halben Zustände).
  - **Ablehnen:** Pflichtfeld Begründung → `review_note`, `status = 'rejected'`, Datei ebenfalls löschen + `document_path = null`.
- Hinweisbox im UI: „Führungszeugnisse werden nach Prüfung automatisch gelöscht – Datenminimierung gem. docs/offene-rechtsfragen.md."

### Seite 2: `/meldungen`
- Tabelle `reports` mit `is_resolved = false`, Detailansicht mit gemeldetem Profil und bisherigen Meldungen gegen dieses Profil (Zähler).
- Aktionen: **Sperren** (`profiles.is_active = false` – Profil verschwindet sofort aus Entdecken, RLS regelt das bereits) · **Entsperren** · **Als erledigt markieren** (`is_resolved = true`). Jede Aktion mit Bestätigungsdialog; Sperren verlangt eine Begründung (vorerst nur im Audit-Log, siehe unten).
- Einfaches Audit-Log als Server-Log (strukturiert, ohne personenbezogene Dokumentinhalte): wer hat wann was entschieden.

### Seite 3: `/partner-orte`
- CRUD für `partner_locations` (Name, Art, Adresse, Bezirk, Koordinaten, Kontakt, `is_verified`). Schreibzugriff über Service-Role; `is_verified = true` macht den Ort in der App sichtbar (Policy existiert).

## Akzeptanzkriterien (Definition of Done)

- [ ] Login nur für Allowlist-Mails; alle anderen sehen 403 – Test mit Fremd-Mail dokumentiert
- [ ] Freigabe eines Zertifikats im Web → `profiles.trust_level` steigt (Trigger), Badge in der App nach Refresh sichtbar
- [ ] Freigabe/Ablehnung eines `background_check` → Datei nachweislich aus dem Bucket gelöscht, `document_path = null` (Screenshot/Storage-Listing im PR)
- [ ] Signierte URLs laufen nach 60 s ab (manueller Test beschrieben)
- [ ] Gesperrtes Profil erscheint nicht mehr im Entdecken-Feed der App
- [ ] Service-Role-Key taucht in keinem Client-Bundle auf (`next build` + Suche im Output dokumentiert)
- [ ] `pnpm typecheck` grün; Vertragsänderung exakt wie freigegeben
- [ ] `qa-reviewer` und `security-reviewer` ohne Blocker

## Nicht im Scope

Partner-Selbstverwaltung (eigenes Portal-Login für MGH), Statistik-Dashboard, E-Mail-Benachrichtigungen an Nutzer bei Statuswechsel, Mehrsprachigkeit.
