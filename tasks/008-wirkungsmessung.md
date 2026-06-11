# Auftrag 008 – Wirkungsmessung: KPIs, Kurzbefragung & Kennzahlen-Dashboard (Backend + Mobile + Web)

*Ablage im Repo unter `tasks/008-wirkungsmessung.md`. Voraussetzung: 005 gemerged (Migration 0008 nach 0007). Hintergrund: Das BSS-Exposé verspricht Wirkungs-KPIs ab Pilot – aktive Matches, wiederkehrende Treffen, Einsamkeits-/Entlastungswerte, NPS. Dieser Auftrag macht das Versprechen messbar; ohne ihn gibt es weder Förder-Reporting noch B2G-Material noch den Beleg „100 zustande gekommene Treffen".*

```bash
git worktree add ../zb-backend-kpi -b feat/backend-metrics
git worktree add ../zb-mobile-kpi  -b feat/mobile-survey
git worktree add ../zb-web-kpi     -b feat/web-dashboard
# in jedem Ordner: claude
# Prompt: "Lies CLAUDE.md, dein Bereichs-CLAUDE.md und tasks/008-wirkungsmessung.md und setze dein Teilpaket um."
```

---

## Ziel

Drei Bausteine: (1) KPI-Aggregation in der Datenbank, (2) eine freiwillige, seltene In-App-Kurzbefragung, (3) eine Kennzahlen-Seite im Web-Admin mit CSV-Export. **Grundsatz: Das Dashboard zeigt ausschließlich Aggregate – es gibt keinen Bildschirm, auf dem das Team Einzelpersonen durchblättern kann.** Profile sieht das Team nur anlassbezogen (Verifizierung, Meldung – Aufträge 002/003).

## Vertragsergänzung (vom Orchestrator freigegeben – exakt so übernehmen)

In `packages/shared/src/types.ts` ergänzen:

```ts
export const SurveyKind = z.enum([
  "nps",              // "Würden Sie Zeitbrücke weiterempfehlen?" – Skala 0–10
  "wellbeing_senior", // "Fühlen Sie sich durch Zeitbrücke weniger allein?" – Skala 1–5
  "relief_family",    // "Entlastet Zeitbrücke Ihren Familienalltag?" – Skala 1–5
]);
export type SurveyKind = z.infer<typeof SurveyKind>;

export const SurveySchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  kind: SurveyKind,
  score: z.number().int().min(0).max(10), // Bedeutung je kind, s. Enum
  comment: z.string().max(600).nullable(),
  created_at: z.string(),
});
export type Survey = z.infer<typeof SurveySchema>;
```

## Teil A – Backend-Agent (Migration `0008_metrics.sql`)

1. **Tabelle `surveys`** gemäß Schema oben (+ `check`-Constraints: `nps` 0–10, sonst 1–5). RLS: Insert nur eigene Zeilen, Select nur eigene; **kein** Lesezugriff auf fremde Antworten – Auswertung läuft ausschließlich über Service-Role.
2. **Befragungs-Rhythmus in der DB sichern:** partieller Unique-Index verhindert mehr als eine Antwort je `(profile_id, kind)` innerhalb von 60 Tagen (z. B. über eine `period`-Spalte `date_trunc`-basiert oder einen Exclusion-Ansatz – Lösung dokumentieren). Die UI fragt seltener; die DB ist die Obergrenze.
3. **KPI-Views** (Namespace `kpi_`, **ohne Grants für `authenticated`** – nur Service-Role liest):
   - `kpi_profiles_weekly`: neue Profile je Woche, Rolle, Bezirk; zusätzlich verifizierte Senioren je Vertrauensstufe
   - `kpi_funnel_weekly`: Anfragen → angenommen → Matches → Matches mit ≥ 1 abgeschlossenen Treffen
   - `kpi_meetings_weekly`: geplante/abgeschlossene/abgesagte Treffen; Anteil Erst-Treffen an Partner-Orten (sollte 100 % sein – Kontrollmetrik für den Trigger aus 005)
   - `kpi_retention`: Matches mit ≥ 2 abgeschlossenen Treffen („wiederkehrende Treffen" – die zentrale Wirkungs-KPI)
   - `kpi_surveys_weekly`: NPS (Promotoren − Detraktoren), Mittelwerte je `SurveyKind`, Antwortzahlen
   - Alle Views liefern nur Zählungen/Mittelwerte ab **n ≥ 5** je Zelle (kleinere Zellen als `null` ausgeben – verhindert Rückschlüsse auf Einzelpersonen in kleinen Bezirken)
4. **Dokumentation in `supabase/CLAUDE.md`:** Welche View welche BSS-KPI belegt; Hinweis, dass `docs/offene-rechtsfragen.md` um den Punkt „Befragungsdaten in Datenschutzerklärung aufnehmen" ergänzt wird.

## Teil B – Mobile-Agent

1. **Befragungs-Trigger:** Nach dem **zweiten abgeschlossenen Treffen** (nicht nach dem ersten – die Antwort wäre Euphorie oder Frust des Einzelfalls) erscheint einmalig ein Karten-Dialog, später frühestens alle 60 Tage wieder. Lokal gespeichert, wann zuletzt gefragt wurde; die DB-Sperre aus Teil A ist das Sicherheitsnetz.
2. **Dialog (max. 2 Fragen, überspringbar):** Frage 1 immer NPS (0–10 als große Tippfelder, nicht Slider – Motorik 60+). Frage 2 je Rolle: Senior → `wellbeing_senior`, Familie → `relief_family` (5 Stufen mit Text-Ankern „stimme nicht zu … stimme voll zu"). Optionales Freitextfeld „Möchten Sie uns etwas mitgeben?".
3. **Tonalität:** Einleitung erklärt ehrlich den Zweck: „Ihre Antwort hilft uns zu zeigen, dass Zeitbrücke wirkt – freiwillig und jederzeit überspringbar." Kein Dark Pattern, „Überspringen" gleichwertig gestaltet (CI-Regel: Augenhöhe).
4. **Demo-Modus:** Dialog über einen Demo-Knopf auslösbar, schreibt lokal.

## Teil C – Web-Agent (`/kennzahlen`)

1. **Kennzahlen-Seite** (Server Components, Daten via Service-Role aus den `kpi_`-Views): Karten für die Kopfzahlen (aktive Senioren nach Stufe, aktive Familien, Matches gesamt, abgeschlossene Treffen gesamt, NPS aktuell) + einfache Wochen-Verlaufscharts (leichtgewichtig, z. B. reine SVG-Balken – kein Chart-Framework nötig). Bezirksfilter für die Pilotsteuerung.
2. **CSV-Export** je View (Route Handler, Allowlist-geschützt wie alles aus 003) – das ist das Format für BSS-Zwischenberichte und B2G-Gespräche.
3. **Meilenstein-Karte:** Fortschritt gegen die Pilotziele aus dem Businessplan (50 verifizierte Senioren · 150 Familien · 100 Treffen) als drei Fortschrittsbalken – Gold erst bei Zielerreichung (CI: Gold belohnt).
4. **Kein Drill-Down auf Personen** – bewusst nicht bauen, auch nicht „nur für Admins".

## Akzeptanzkriterien (Definition of Done)

- [ ] Negativtests: Nutzer B liest keine Surveys von Nutzer A; `authenticated` kann keine `kpi_`-View abfragen; zweite Antwort gleicher Art innerhalb 60 Tagen wird von der DB abgelehnt
- [ ] Zellen mit n < 5 erscheinen als `null`/„–" im Dashboard (Test mit Mini-Datensatz dokumentiert)
- [ ] Befragung erscheint erst nach dem zweiten abgeschlossenen Treffen, ist überspringbar und erscheint danach 60 Tage nicht wieder (Zeitreise-Test beschreiben)
- [ ] Kennzahlen-Seite zeigt mit Seed-Daten plausible Werte; CSV-Export öffnet sauber in Excel (UTF-8, Semikolon)
- [ ] Kontrollmetrik „Erst-Treffen am Partner-Ort" zeigt 100 % (beweist Trigger aus 005 im Feld)
- [ ] `pnpm typecheck` grün; Vertragsänderung exakt wie freigegeben; `qa-reviewer` und `security-reviewer` ohne Blocker

## Nicht im Scope

Externe Analytics-SDKs (Tracking-Anbieter nur nach AVV-/Einwilligungs-Klärung – vorerst gar nicht), A/B-Testing, Kohorten-Analysen, automatische Berichts-Mails, öffentliche Wirkungs-Seite (Marketing, später aus denselben Views speisbar), Forschungs-Kooperation/Evaluation (interessant für Krankenkassen-Gespräche – eigener Auftrag nach Pilot).
