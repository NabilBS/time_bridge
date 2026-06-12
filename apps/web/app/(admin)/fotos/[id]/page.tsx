import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/ActionForm";
import { formatDateTime } from "@/lib/dates";
import { roleLabel } from "@/lib/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PhotoSubmissionRow, ProfileBasics } from "@/lib/types";
import { approvePhotoAction, rejectPhotoAction } from "../actions";
import { REJECT_REASONS } from "../reject-reasons";

export const dynamic = "force-dynamic";

export default async function FotoPruefenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("photo_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Die Einreichung konnte nicht geladen werden: ${error.message}`);
  }
  if (!data) {
    notFound();
  }
  const submission = data as PhotoSubmissionRow;

  const { data: profileData } = await admin
    .from("profiles")
    .select("id, display_name, role, district, trust_level, is_active, created_at")
    .eq("id", submission.profile_id)
    .maybeSingle();
  const profile = (profileData as ProfileBasics | null) ?? null;

  // Vorschau nur über kurzlebige signierte URL (60 s) – kein Download-Link.
  let signedUrl: string | null = null;
  if (submission.status === "submitted") {
    const { data: signed } = await admin.storage
      .from("avatars-pending")
      .createSignedUrl(submission.storage_path, 60);
    signedUrl = signed?.signedUrl ?? null;
  }

  return (
    <>
      <Link href="/fotos" className="back-link">
        ← Zurück zur Liste
      </Link>
      <h1>Foto prüfen{profile ? `: ${profile.display_name}` : ""}</h1>

      <div className="hint-box">
        Fotos mit Kindern werden immer abgelehnt – auch die eigenen Enkel. Bitte erklären Sie es
        in der Begründung freundlich; das ist der häufigste Fall.
      </div>

      <div className="action-grid">
        <div className="action-card">
          <h3>Foto</h3>
          {submission.status !== "submitted" ? (
            <p className="muted">Diese Einreichung wurde bereits bearbeitet.</p>
          ) : signedUrl ? (
            <div className="document-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signedUrl} alt="Eingereichtes Profilfoto" />
            </div>
          ) : (
            <p className="muted">Die Vorschau konnte nicht erzeugt werden – Seite neu laden.</p>
          )}
          <p className="form-hint">
            Die Vorschau-Adresse läuft nach 60 Sekunden ab. Eingereicht am{" "}
            {formatDateTime(submission.created_at)}.
          </p>
        </div>

        <div className="action-card">
          <h3>Profil</h3>
          {profile ? (
            <ul className="kpi-list">
              <li>Anzeigename: {profile.display_name}</li>
              <li>Rolle: {roleLabel(profile.role)}</li>
              <li>Bezirk: {profile.district}</li>
            </ul>
          ) : (
            <p className="muted">Profil nicht gefunden.</p>
          )}
        </div>

        {submission.status === "submitted" ? (
          <>
            <div className="action-card">
              <h3>Freigeben</h3>
              <p className="form-hint">
                Das Foto wird in das öffentliche Profil übernommen; die Pending-Datei wird
                gelöscht.
              </p>
              <ActionForm
                action={approvePhotoAction}
                confirmMessage="Möchten Sie dieses Foto freigeben? Es wird damit für alle sichtbar."
              >
                <input type="hidden" name="id" value={submission.id} />
                <button type="submit" className="button button-primary">
                  Foto freigeben
                </button>
              </ActionForm>
            </div>

            <div className="action-card">
              <h3>Ablehnen</h3>
              <ActionForm
                action={rejectPhotoAction}
                confirmMessage="Möchten Sie dieses Foto ablehnen? Die Datei wird gelöscht und die Begründung der Person angezeigt."
              >
                <input type="hidden" name="id" value={submission.id} />
                <div className="form-row">
                  <label htmlFor="reason">Begründung *</label>
                  <select id="reason" name="reason" required defaultValue="">
                    <option value="" disabled>
                      Bitte wählen …
                    </option>
                    {Object.entries(REJECT_REASONS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label htmlFor="note">Anmerkung (optional, sieht die Person)</label>
                  <textarea
                    id="note"
                    name="note"
                    rows={3}
                    maxLength={500}
                    placeholder="z. B. Bitte laden Sie ein Foto hoch, auf dem nur Sie zu sehen sind."
                  />
                </div>
                <button type="submit" className="button button-danger">
                  Foto ablehnen
                </button>
              </ActionForm>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
