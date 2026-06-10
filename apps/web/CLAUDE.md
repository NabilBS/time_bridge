# apps/web – Konventionen (Zeitbrücke Admin)

Interne Admin-Web-App (Next.js 15, App Router, TypeScript strict). Einstieg: `pnpm dev`,
Typprüfung: `pnpm typecheck` (muss vor jedem Commit grün sein).

## Struktur

- `app/` – Routen (App Router). Öffentlich nur `/login` und `/auth/callback` (PKCE-Magic-Link);
  alles andere liegt in der Route-Group `app/(admin)/` hinter Login + Allowlist.
  Seiten: `/verifizierungen` (+ `[id]`), `/meldungen` (+ `[id]`), `/partner-orte` (+ `neu`, `[id]`).
- `middleware.ts` – Session-Refresh nach @supabase/ssr-Muster (getAll/setAll); leitet ohne
  Session auf `/login` um. Die Allowlist prüft `requireAdmin()` serverseitig (kein Treffer → `/403`).
- `lib/supabase/admin.ts` – Service-Role-Client, importiert `server-only`. **Niemals in
  Client-Komponenten importieren** – der Service-Role-Key darf nie ins Client-Bundle.
- `lib/supabase/server.ts` / `client.ts` – Anon-Clients (Server bzw. Browser, nur Login).
- `lib/auth.ts` – `requireAdmin()`: Session + Allowlist `ADMIN_EMAILS` (kommagetrennt,
  case-insensitive). In **jedem** Layout-Check und in **jeder** Server Action aufrufen.
- `lib/audit.ts` – strukturiertes Audit-Log (`{ at, admin_email, action, target, reason? }`).
  Keine Dokumentinhalte oder signierten URLs loggen.
- `components/ActionForm.tsx` – Formular-Hülle für Server Actions: `confirm()`-Dialog vor dem
  Absenden + Fehleranzeige (`useActionState`). Alle mutierenden Aktionen laufen darüber.

## Regeln

- Service-Role-Key ausschließlich serverseitig (Server Components, Server Actions, Route
  Handler). Datenbank-Schreibzugriffe nur über `createAdminClient()`.
- Eingaben in Server Actions immer mit Zod validieren; Fehlermeldungen deutsch, konkret, Sie-Form.
- Untypisierte Supabase-Clients; Abfrage-Ergebnisse auf die Interfaces in `lib/types.ts` casten.
- Dokument-Vorschau: signierte URL serverseitig erzeugen, **max. 60 Sekunden**, nur im Server
  Component rendern – kein Download-Link, nicht im Client-State persistieren.
- Löschregel Führungszeugnis: in derselben Server Action **zuerst** die Datei im Bucket löschen
  (bei Fehler komplette Aktion abbrechen), dann Update mit `document_path = null`.
- Design nur über die CSS-Tokens in `app/globals.css` (Fichte `#2F6B4F`, Gold `#C9A227`,
  Papier `#FFFDF8`, Text `#1F2933`, Schrift „Atkinson Hyperlegible"). Kein Tailwind, keine
  hartkodierten Farben in Komponenten.
- `trust_level` schreibt nie die Web-App – das macht der DB-Trigger bei Statuswechseln.
- UI-Texte deutsch und in Sie-Form; nüchtern und tabellenorientiert.

## Env (siehe `.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
(nur Server!), `ADMIN_EMAILS`.
