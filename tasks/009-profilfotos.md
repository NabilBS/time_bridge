# Auftrag 009 – Profilfotos mit Moderation (Mobile + Backend + Web)

*Ablage im Repo unter `tasks/009-profilfotos.md`. Voraussetzung: 003 gemerged (Prüf-Oberfläche existiert); Migration 0009 nach 0008. Hintergrund: Gesichter treiben Vertrauen und Match-Quote im Entdecken-Feed – aber auf einer Plattform mit Kinderkontakt darf kein Foto ungeprüft sichtbar werden.*

```bash
git worktree add ../zb-backend-fotos -b feat/backend-photos
git worktree add ../zb-mobile-fotos  -b feat/mobile-photos
git worktree add ../zb-web-fotos     -b feat/web-photo-review
# in jedem Ordner: claude
# Prompt: "Lies CLAUDE.md, dein Bereichs-CLAUDE.md und tasks/009-profilfotos.md und setze dein Teilpaket um."
```

---

## Ziel

Nutzer laden ein Profilfoto hoch, das Team gibt es frei, erst dann wird es sichtbar. **Kein Foto erreicht andere Nutzer ohne Freigabe** – das gleiche Muster wie bei Verifizierungen (Auftrag 002/003), bewusst wiederverwendet.

## Vertragsergänzung (vom Orchestrator freigegeben – exakt so übernehmen)

In `packages/shared/src/types.ts` ergänzen:

```ts
/** Foto-Einreichungen folgen dem Verifizierungs-Muster; 'expired' bleibt ungenutzt. */
export const PhotoSubmissionSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  storage_path: z.string(),
  status: VerificationStatus,
  review_note: z.string().nullable(),
  created_at: z.string(),
});
export type PhotoSubmission = z.infer<typeof PhotoSubmissionSchema>;
```

## Teil A – Backend-Agent (Migration `0009_photo_moderation.sql`)

1. **Bucket `avatars-pending`** (per Migration): privat, 5 MB, nur jpeg/png/webp. Eingereichte Fotos liegen **nie** im öffentlichen `avatars`-Bucket – „public" heißt dort: jeder mit URL kann lesen, und genau das darf vor der Freigabe nicht passieren.
2. **Tabelle `photo_submissions`** gemäß Vertrag. RLS: Insert/Select nur eigene Zeilen (`status = 'submitted'` beim Insert); Prüfung über Service-Role. Partieller Unique-Index: nur eine offene Einreichung je Profil.
3. **Storage-Policies `avatars-pending`:** INSERT/SELECT nur eigener Pfad (`{uid}/...`), kein UPDATE/DELETE für Nutzer – identisches Muster wie `verification-docs`.
4. **Lücke schließen – `profiles_update_own` härten:** Die bestehende Policy erlaubt Nutzern, `photo_path` direkt zu setzen – damit ließe sich die Moderation komplett umgehen (beliebigen Pfad eintragen). Gleicher Schutz wie bei `trust_level`: `photo_path` ist für Nutzer unveränderlich, nur die Service-Role (Freigabe-Action) schreibt es.

## Teil B – Mobile-Agent

1. **Foto-Upload im Profil-Tab:** Kamera oder Galerie (`expo-image-picker`), quadratischer Zuschnitt + Verkleinerung auf max. 1024 px (`expo-image-manipulator`, erlaubte Dependencies). **Wichtig: Die Neukodierung entfernt EXIF-Metadaten inkl. GPS-Position – das ist Pflicht, nicht Nebeneffekt; im PR nachweisen.**
2. **Klare Regeln vor dem Upload** (eigener Hinweis-Screen): „Bitte ein aktuelles Foto, auf dem nur Sie zu sehen sind. Keine Kinder, keine anderen Personen, keine Gruppenbilder." – die eiserne Markenregel (CI Abschnitt 06) gilt zuerst für uns selbst.
3. **Status-UI:** `submitted` = eigenes Foto mit Schleier + „Wird geprüft" · `approved` = Foto live · `rejected` = Begründung aus `review_note` + erneuter Upload möglich.
4. **Avatar-Komponente** `components/Avatar.tsx`: zeigt `photo_path` (public URL) oder Initialen-Kreis in Fichte als Fallback; Einbau in ProfileCard, Profildetail, Chat-Liste, Anfragen-Karten. Eigene Ansicht zeigt zusätzlich den Pending-Zustand.
5. **Demo-Modus:** Upload + simulierte Freigabe lokal.

## Teil C – Web-Agent (`/fotos`)

1. Queue aller `photo_submissions` mit `status = 'submitted'` (älteste zuerst): Vorschau über kurzlebige signierte URL (60 s) aus `avatars-pending`, daneben Profil-Basisdaten.
2. **Freigeben** (Server Action, atomar): Datei nach `avatars/{uid}/avatar.jpg` kopieren → `profiles.photo_path` setzen → Pending-Datei löschen → `status = 'approved'`. Schlägt ein Schritt fehl, schlägt alles fehl.
3. **Ablehnen:** Pflicht-Begründung per Schnellauswahl („Kind im Bild", „Andere Person erkennbar", „Person nicht erkennbar", „Unangemessen") + Freitext → `review_note`, Pending-Datei löschen.
4. Hinweisbox: „Fotos mit Kindern werden immer abgelehnt – auch die eigenen Enkel." (häufigster erwartbarer Fall, freundlich erklären).

## Akzeptanzkriterien (Definition of Done)

- [ ] Negativtest: eingereichtes, noch nicht freigegebenes Foto ist für andere Nutzer unter keiner URL abrufbar; Nutzer B liest keine Submissions von Nutzer A
- [ ] Negativtest: direkter Update-Versuch auf `profiles.photo_path` durch den Nutzer wird von der DB abgelehnt
- [ ] EXIF-Nachweis: hochgeladene Datei enthält keine GPS-/Metadaten (Vorher/Nachher im PR)
- [ ] Freigabe im Web → Foto erscheint in der App (Feed, Detail, Chat) nach Refresh; Ablehnung → Begründung beim Nutzer sichtbar
- [ ] Nur eine offene Einreichung je Profil (DB + UI)
- [ ] Demo-Modus vollständig; `pnpm typecheck` grün; Vertragsänderung exakt wie freigegeben
- [ ] `qa-reviewer` und `security-reviewer` ohne Blocker

## Nicht im Scope

Automatische Bilderkennung/KI-Moderation (Pilotvolumen ist manuell prüfbar; Anbieter-Frage inkl. AVV später), mehrere Fotos pro Profil, Foto-Pflicht (bleibt optional), Bild-Nachrichten im Chat.
