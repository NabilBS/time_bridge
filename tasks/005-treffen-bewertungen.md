# Auftrag 005 – Treffen am Partner-Ort & Bewertungen (Backend-Agent + Mobile-Agent)

*Ablage im Repo unter `tasks/005-treffen-bewertungen.md`. Voraussetzung: Auftrag 004 gemerged (Migrationen sequenziell: 0005 nach 0004).*

```bash
git worktree add ../zb-backend-treffen -b feat/backend-meetings
git worktree add ../zb-mobile-treffen  -b feat/mobile-meetings
# in jedem Ordner: claude
# Prompt: "Lies CLAUDE.md, dein Bereichs-CLAUDE.md und tasks/005-treffen-bewertungen.md und setze dein Teilpaket aus Auftrag 005 um."
```

---

## Ziel

Das zentrale Sicherheitsversprechen wird Produkt: Matches verabreden ihr **erstes Treffen an einem verifizierten Partner-Ort** – erzwungen in der Datenbank, nicht nur empfohlen im Text. Nach Treffen bewerten sich beide Seiten; die Bewertungen speisen das Vertrauensprofil.

## Vertragsergänzung (vom Orchestrator freigegeben – exakt so übernehmen)

In `packages/shared/src/types.ts` ergänzen:

```ts
export const MeetingStatus = z.enum(["planned", "completed", "cancelled"]);
export type MeetingStatus = z.infer<typeof MeetingStatus>;

export const MeetingSchema = z.object({
  id: z.string().uuid(),
  match_id: z.string().uuid(),
  partner_location_id: z.string().uuid().nullable(),
  scheduled_at: z.string(),
  status: MeetingStatus,
  created_at: z.string(),
});
export type Meeting = z.infer<typeof MeetingSchema>;

export const PartnerLocationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: PartnerKind,
  street: z.string().nullable(),
  postal_code: z.string().nullable(),
  district: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  is_verified: z.boolean(),
});
export type PartnerLocation = z.infer<typeof PartnerLocationSchema>;

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().uuid(),
  reviewer_id: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(600).nullable(),
  created_at: z.string(),
});
export type Review = z.infer<typeof ReviewSchema>;

/** Aggregierte Bewertungen eines Profils – nur über diese RPC, nie per Join. */
export const RPC_REVIEW_STATS = "review_stats";
```

## Teil A – Backend-Agent (Migration `0005_meetings_reviews.sql`)

1. **Ersttreffen-Pflicht als Trigger** `enforce_first_meeting_location` (before insert auf `meetings`): Existiert für das Match noch kein Treffen mit Status `planned` oder `completed`, muss `partner_location_id` gesetzt sein **und** auf einen Ort mit `is_verified = true` zeigen – sonst sprechende Exception („Das erste Treffen findet an einem Partner-Ort statt."). Folgetreffen sind frei.
2. **Review-Policy härten** (gleiches Muster wie 004): Die bestehende Policy `review_write` erlaubt Bewertungen für beliebige Meetings. Ersetzen durch: Insert nur, wenn der Aufrufer Match-Mitglied des Meetings ist **und** das Meeting `status = 'completed'` hat. Zusätzlich: `review_read` von `using (true)` einschränken auf Match-Mitglieder **plus** Zugriff über die RPC unten (Einzel-Kommentare sind nicht öffentlich, nur Aggregate).
3. **RPC `review_stats(p_profile uuid)`** (`security definer`): liefert `review_count` und `avg_stars` der Bewertungen, die *über* dieses Profil geschrieben wurden (bewertete Person = das jeweils andere Match-Mitglied). Nur Aggregate, nie Einzelzeilen. `grant execute` an `authenticated`.
4. **Treffen-Abschluss:** pg_cron-Job markiert nichts automatisch – `completed` setzen die Beteiligten selbst (UI). Aber: Job setzt `planned`-Treffen mit `scheduled_at < now() - interval '14 days'` auf `cancelled` (Datenhygiene).
5. **Seed für Entwicklung** (`supabase/seed.sql`): 5 fiktive Partner-Orte über mehrere Bezirke (klar als Platzhalter benannt, z. B. „MGH Musterstraße [Platzhalter]"), `is_verified = true` – echte Orte pflegt das Team später über den Web-Admin aus Auftrag 003.

## Teil B – Mobile-Agent

1. **Treffen vorschlagen** (Einstieg im Chat-Header „Treffen planen" + nach Match-Entstehung als Hinweiskarte):
   - Schritt 1: Partner-Ort wählen – Liste verifizierter Orte, vorgefiltert auf die Bezirke beider Profile, mit Name, Art (`PARTNER_KIND_LABELS`), Adresse; Karte ist *nicht* nötig (kein Map-SDK in diesem Auftrag)
   - Schritt 2: Datum + Uhrzeit (Picker, nur Zukunft)
   - Schritt 3: Bestätigen → Insert `meetings`; im Chat erscheint eine Treffen-Karte (Ort, Zeit, Status), für beide sichtbar
   - Beim **ersten** Treffen erklärt ein fester Hinweis, *warum* der Ort vorgegeben ist: „Zur Sicherheit aller findet das erste Treffen an einem geprüften Partner-Ort statt." Folgetreffen: Ort frei wählbar (Freitext) oder erneut Partner-Ort
2. **Treffen verwalten:** Karte im Chat mit Aktionen „Absagen" (Status `cancelled`, Hinweis an Gegenseite) und – nach Ablauf von `scheduled_at` – „Hat stattgefunden" (Status `completed`)
3. **Bewertung:** Nach `completed` erscheint für beide ein Bewertungs-Dialog (5 Sterne + optionaler Kommentar, `ReviewSchema`); genau eine Bewertung je Person und Treffen (DB erzwingt das, UI fängt es ab)
4. **Vertrauensprofil:** In Profildetail (`profil-detail/[id]`) unter dem TrustBadge: „⌀ 4,8 von 5 · 12 Treffen" via `supabase.rpc(RPC_REVIEW_STATS, ...)`; bei 0 Bewertungen: „Noch keine Treffen über Zeitbrücke"
5. **Demo-Modus:** kompletter Ablauf lokal – Demo-Partner-Orte, simuliertes Treffen, Bewertungs-Dialog, Aggregat aktualisiert sich
6. **Texte:** deutsch, Sie-Form; Absagen ohne Schuldzuweisung formuliert („Das Treffen wurde abgesagt.")

## Akzeptanzkriterien (Definition of Done)

- [ ] Negativtest dokumentiert: erstes Treffen ohne Partner-Ort oder mit nicht-verifiziertem Ort → DB lehnt ab; Folgetreffen ohne Ort → erlaubt
- [ ] Negativtest: Bewertung durch Dritte oder vor `completed` → DB lehnt ab; zweite Bewertung derselben Person → abgelehnt und in UI abgefangen
- [ ] `review_stats` liefert für ein Profil korrektes Aggregat; Einzelkommentare fremder Matches sind nicht abrufbar
- [ ] Voller Ablauf auf zwei Geräten: Treffen planen → Karte bei beiden → completed → beidseitige Bewertung → Aggregat im Profil sichtbar
- [ ] Demo-Modus vollständig; `pnpm typecheck` grün; Vertragsänderung exakt wie freigegeben
- [ ] `qa-reviewer` und `security-reviewer` ohne Blocker; PR mit Screen-Recording

## Nicht im Scope

Kartenansicht/Map-SDK, Kalender-Export (ICS), Terminabstimmung mit mehreren Vorschlägen, Erinnerungs-Pushes (Auftrag 006), Bewertungs-Moderation im Web-Admin (Folgeauftrag), öffentliche Anzeige von Einzelkommentaren.
