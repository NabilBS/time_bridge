import Link from "next/link";
import { notFound } from "next/navigation";

import { VERIFICATION_TYPE_LABELS } from "@zeitbruecke/shared";

import { ActionForm } from "@/components/ActionForm";
import { formatDate, formatDateTime, todayIsoDate } from "@/lib/dates";
import { roleLabel } from "@/lib/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import type { VerificationRow } from "@/lib/types";
import { approveVerificationAction, rejectVerificationAction } from "../actions";

export const dynamic = "force-dynamic";

type VerificationDetailRow = VerificationRow & {
  profiles: { display_name: string; role: string; district: string } | null;
};

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "heic", "webp"];

export default async function VerifizierungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("verifications")
    .select("*, profiles(display_name, role, district)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Einreichung konnte nicht geladen werden: ${error.message}`);
  }
  if (!data) {
    notFound();
  }
  const verification = data as VerificationDetailRow;
  const isBackgroundCheck = verification.type === "background_check";

  // Signierte URL nur serverseitig erzeugen, max. 60 Sekunden gültig.
  // Bewusst nicht persistieren oder an Client-State weiterreichen – nur rendern.
  let signedUrl: string | null = null;
  let extension: string | null = null;
  if (verification.document_path) {
    const { data: signed } = await admin.storage
      .from("verification-docs")
      .createSignedUrl(verification.document_path, 60);
    signedUrl = signed?.signedUrl ?? null;
    extension = verification.document_path.split(".").pop()?.toLowerCase() ?? null;
  }

  return (
    <>
      <Link href="/verifizierungen" className="back-link">
        ← Zurück zur Liste
      </Link>
      <h1>Einreichung prüfen: {VERIFICATION_TYPE_LABELS[verification.type]}</h1>

      <table className="table detail-table">
        <tbody>
          <tr>
            <th scope="row">Anzeigename</th>
            <td>{verification.profiles?.display_name ?? "–"}</td>
          </tr>
          <tr>
            <th scope="row">Rolle</th>
            <td>{verification.profiles ? roleLabel(verification.profiles.role) : "–"}</td>
          </tr>
          <tr>
            <th scope="row">Bezirk</th>
            <td>{verification.profiles?.district ?? "–"}</td>
          </tr>
          <tr>
            <th scope="row">Eingereicht am</th>
            <td>{formatDateTime(verification.created_at)}</td>
          </tr>
          <tr>
            <th scope="row">Status</th>
            <td>{verification.status}</td>
          </tr>
        </tbody>
      </table>

      <h2>Dokument</h2>
      {signedUrl ? (
        <>
          <div className="document-preview">
            {extension === "pdf" ? (
              <iframe src={signedUrl} title="Dokument-Vorschau (PDF)" />
            ) : IMAGE_EXTENSIONS.includes(extension ?? "") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signedUrl} alt="Dokument-Vorschau" />
            ) : (
              <p className="muted">
                Für dieses Dateiformat gibt es keine Vorschau. Bitte wenden Sie sich an das Team.
              </p>
            )}
          </div>
          <p className="form-hint">
            Die Vorschau ist aus Datenschutzgründen nur 60 Sekunden gültig. Laden Sie die Seite
            neu, wenn die Vorschau abgelaufen ist.
          </p>
        </>
      ) : (
        <p className="muted">Kein Dokument vorhanden.</p>
      )}

      <div className="hint-box">
        Führungszeugnisse werden nach Prüfung automatisch gelöscht – Datenminimierung gem.
        docs/offene-rechtsfragen.md.
      </div>

      <h2>Entscheidung</h2>
      <div className="action-grid">
        <div className="action-card">
          <h3>Freigeben</h3>
          <ActionForm
            action={approveVerificationAction}
            confirmMessage="Möchten Sie diese Einreichung wirklich freigeben?"
          >
            <input type="hidden" name="id" value={verification.id} />
            {isBackgroundCheck ? (
              <div className="form-row">
                <label htmlFor="issue_date">Ausstellungsdatum des Führungszeugnisses *</label>
                <input id="issue_date" name="issue_date" type="date" required max={todayIsoDate()} />
                <p className="form-hint">
                  Hinweis: Das Führungszeugnis sollte bei Einreichung (hier am{" "}
                  {formatDate(verification.created_at)}) nicht älter als 3 Monate gewesen sein.
                  Die Gültigkeit wird automatisch auf Ausstellungsdatum + 3 Jahre gesetzt; das
                  Dokument wird nach der Freigabe gelöscht.
                </p>
              </div>
            ) : null}
            <button type="submit" className="button button-primary">
              Freigeben
            </button>
          </ActionForm>
        </div>

        <div className="action-card">
          <h3>Ablehnen</h3>
          <ActionForm
            action={rejectVerificationAction}
            confirmMessage="Möchten Sie diese Einreichung wirklich ablehnen? Das Dokument wird dabei gelöscht."
          >
            <input type="hidden" name="id" value={verification.id} />
            <div className="form-row">
              <label htmlFor="review_note">Begründung *</label>
              <textarea
                id="review_note"
                name="review_note"
                rows={4}
                required
                maxLength={600}
                placeholder="Die Begründung ist für die betroffene Person sichtbar."
              />
            </div>
            <button type="submit" className="button button-danger">
              Ablehnen
            </button>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
