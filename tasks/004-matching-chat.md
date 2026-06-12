# Auftrag 004 – Matching & Chat: der Produktkern (Backend-Agent + Mobile-Agent)

*Ablage im Repo unter `tasks/004-matching-chat.md`. Parallel möglich; der Vertrag unten fixiert die Schnittstellen. Migrationsreihenfolge beachten: 0004 kommt nach 0003 (Auftrag 003) – der Orchestrator merged Backend-PRs sequenziell.*

```bash
git worktree add ../zb-backend-matching -b feat/backend-matching
git worktree add ../zb-mobile-matching  -b feat/mobile-matching
# in jedem Ordner: claude
# Prompt: "Lies CLAUDE.md, dein Bereichs-CLAUDE.md und tasks/004-matching-chat.md und setze dein Teilpaket aus Auftrag 004 um."
```

---

## Ziel

Der komplette Kern-Loop funktioniert: Familie entdeckt Senior (oder umgekehrt) → sendet Anfrage → Gegenseite nimmt an → Match entsteht → beide chatten. **Doppel-Opt-in wird nicht in der App geprüft, sondern in der Datenbank erzwungen.**

## Vertragsergänzung (vom Orchestrator freigegeben – exakt so übernehmen)

In `packages/shared/src/types.ts` ergänzen:

```ts
export const MatchRequestSchema = z.object({
  id: z.string().uuid(),
  from_profile: z.string().uuid(),
  to_profile: z.string().uuid(),
  message: z.string().max(600).nullable(),
  status: MatchRequestStatus,
  created_at: z.string(),
  responded_at: z.string().nullable(),
});
export type MatchRequest = z.infer<typeof MatchRequestSchema>;

export const MatchSchema = z.object({
  id: z.string().uuid(),
  profile_a: z.string().uuid(),
  profile_b: z.string().uuid(),
  created_at: z.string(),
});
export type Match = z.infer<typeof MatchSchema>;

/** Annahme läuft NUR über diese RPC – nie per direktem Update. */
export const RPC_ACCEPT_REQUEST = "accept_match_request";
```

## Teil A – Backend-Agent (Migration `0004_matching.sql`)

1. **RLS-Härtung `match_requests` (Sicherheitslücke schließen):** Die bestehende Policy `req_respond` erlaubt Beteiligten beliebige Updates – damit könnte der **Absender** seine Anfrage selbst auf `accepted` setzen. Ersetzen durch zwei enge Policies:
   - Absender: nur `pending → withdrawn` (`with check (from_profile = auth.uid() and status = 'withdrawn')`)
   - Empfänger: nur `pending → declined` (`with check (to_profile = auth.uid() and status = 'declined')`)
   - `accepted` ist per direktem Update **unmöglich** und geht nur über die Funktion unten. `responded_at` in beiden Fällen via Trigger oder in der Funktion setzen.
2. **RPC `accept_match_request(p_request uuid) returns uuid`** (`security definer`, transaktional):
   - Prüft: Aufrufer ist `to_profile`, Status ist `pending`, beide Profile `is_active = true`
   - Setzt `status = 'accepted'`, `responded_at = now()`
   - Legt Match in kanonischer Reihenfolge an (`least/greatest` für `profile_a < profile_b`), `request_id` verknüpft; existiert das Paar schon, gibt sie das bestehende Match zurück (idempotent)
   - Gibt die Match-ID zurück; jede Verletzung wirft eine sprechende Exception
   - `grant execute` an `authenticated`; kein insert-Recht auf `matches` für Nutzer (gibt es bereits nicht – so bleibt es)
3. **Realtime:** `messages` zur Publication `supabase_realtime` hinzufügen. Hinweis dokumentieren: Realtime respektiert RLS – Test, dass ein Dritter den Kanal eines fremden Matches nicht lesen kann, gehört zum Paket.
4. **Entdecken-Performance:** Index auf `profiles (role, district, trust_level) where is_active = true`.

## Teil B – Mobile-Agent

1. **Entdecken live** (`app/(tabs)/index.tsx`): Mock raus (bleibt nur für `isDemo`), Query auf `profiles` mit Gegenrolle des eingeloggten Nutzers; Filter über `SearchFilterSchema` (Bezirk, Mindest-Vertrauensstufe, Interessen-Überschneidung); Pull-to-Refresh; Pagination ab 20 Einträgen.
2. **Profildetail** `app/profil-detail/[id].tsx`: volle Vorstellung inkl. TrustBadge, Interessen, Verfügbarkeit (bei Senioren); CTA „Anfrage senden" mit optionaler Nachricht (`CreateMatchRequestSchema`). Nach dem Senden Status-Hinweis: „Anfrage verschickt – wenn [Name] zustimmt, können Sie sich schreiben." Doppelte Anfrage wird abgefangen (DB-Index existiert) und freundlich erklärt.
3. **Anfragen-Tab live:** zwei Abschnitte – *Erhalten* (Karten mit Nachricht, Buttons „Annehmen" → `supabase.rpc(RPC_ACCEPT_REQUEST, ...)` · „Ablehnen" → Update auf `declined`) und *Gesendet* (Status + „Zurückziehen"). Annahme navigiert direkt in den neuen Chat.
4. **Chat:** `app/(tabs)/chats.tsx` (Tab ergänzen) mit Match-Liste (Partnername, letzte Nachricht) und `app/chat/[matchId].tsx`: Verlauf, Eingabefeld, Realtime-Subscription, optimistisches Senden mit Fehler-Rollback. Im Chat-Header dauerhaft der Hinweis: „Tipp: Verabreden Sie Ihr erstes Treffen an einem Partner-Ort in Ihrer Nähe." (Treffen-Planung selbst ist Auftrag 005.)
5. **Sicherheits-UI:** In Profildetail und Chat ein „Melden"-Eintrag (Insert in `reports` mit Grund-Auswahl + Freitext) – Pflicht laut Risikoplan, gehört zum Kern-Loop.
6. **Demo-Modus:** kompletter Loop lokal durchspielbar (Anfrage an Demo-Profil → simulierte Annahme nach 2 s → Demo-Chat antwortet mit einer festen Nachricht).
7. **Texte:** durchgängig deutsch, Sie-Form, leere Zustände erklären den nächsten Schritt (z. B. Anfragen leer: „Noch keine Anfragen – stöbern Sie im Entdecken-Bereich.").

## Akzeptanzkriterien (Definition of Done)

- [ ] Negativtests dokumentiert: Absender kann nicht selbst annehmen; Dritter kann fremde Anfragen weder lesen noch ändern; Dritter empfängt keine Realtime-Events eines fremden Matches
- [ ] Voller Loop auf zwei Geräten/Simulatoren: Anfrage → Annahme per RPC → Match → Nachricht erscheint in < 2 s beim Gegenüber
- [ ] Ablehnen, Zurückziehen, erneutes Anfragen nach Ablehnung funktionieren und sind verständlich betextet
- [ ] Gesperrte/inaktive Profile: keine Anfragen möglich, bestehende Chats zeigen Hinweis „Dieses Profil ist nicht mehr aktiv."
- [ ] Melden-Flow erzeugt `reports`-Zeile (im Web-Admin aus Auftrag 003 sichtbar)
- [ ] Demo-Modus vollständig; `pnpm typecheck` grün; Vertragsänderung exakt wie freigegeben
- [ ] `qa-reviewer` und `security-reviewer` ohne Blocker; PRs mit Screen-Recording des Loops

## Nicht im Scope

Treffen-Planung mit Partner-Ort-Auswahl und Bewertungen (Auftrag 005), Push-Notifications, kuratierte Vorschläge/Ranking (nach Pilotdaten), Bild-Nachrichten, Blockieren einzelner Nutzer (vorerst über Melden + Admin).
