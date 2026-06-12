import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/ActionForm";
import { formatDate, formatDateTime } from "@/lib/dates";
import { reportReasonLabel, roleLabel } from "@/lib/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileBasics, ReportRow } from "@/lib/types";
import { blockProfileAction, resolveReportAction, unblockProfileAction } from "../actions";

export const dynamic = "force-dynamic";

type ReportDetailRow = ReportRow & {
  reporter: { display_name: string } | null;
  reported: ProfileBasics | null;
};

export default async function MeldungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reports")
    .select(
      "*, reporter:profiles!reports_reporter_profile_fkey(display_name), reported:profiles!reports_reported_profile_fkey(id, display_name, role, district, trust_level, is_active, created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Meldung konnte nicht geladen werden: ${error.message}`);
  }
  if (!data) {
    notFound();
  }
  const report = data as ReportDetailRow;

  // Zähler: alle bisherigen Meldungen gegen dieses Profil (inkl. erledigter).
  let totalReports: number | null = null;
  if (report.reported) {
    const { count } = await admin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reported_profile", report.reported.id);
    totalReports = count;
  }

  return (
    <>
      <Link href="/meldungen" className="back-link">
        ← Zurück zur Liste
      </Link>
      <h1>Meldung bearbeiten</h1>

      <table className="table detail-table">
        <tbody>
          <tr>
            <th scope="row">Gemeldet am</th>
            <td>{formatDateTime(report.created_at)}</td>
          </tr>
          <tr>
            <th scope="row">Gemeldet von</th>
            <td>{report.reporter?.display_name ?? "–"}</td>
          </tr>
          <tr>
            <th scope="row">Grund</th>
            <td>{reportReasonLabel(report.reason)}</td>
          </tr>
          <tr>
            <th scope="row">Details</th>
            <td>{report.details ?? "–"}</td>
          </tr>
          <tr>
            <th scope="row">Status der Meldung</th>
            <td>{report.is_resolved ? "erledigt" : "offen"}</td>
          </tr>
        </tbody>
      </table>

      <h2>Gemeldetes Profil</h2>
      {report.reported ? (
        <>
          <table className="table detail-table">
            <tbody>
              <tr>
                <th scope="row">Anzeigename</th>
                <td>{report.reported.display_name}</td>
              </tr>
              <tr>
                <th scope="row">Rolle</th>
                <td>{roleLabel(report.reported.role)}</td>
              </tr>
              <tr>
                <th scope="row">Bezirk</th>
                <td>{report.reported.district}</td>
              </tr>
              <tr>
                <th scope="row">Vertrauensstufe</th>
                <td>{report.reported.trust_level}</td>
              </tr>
              <tr>
                <th scope="row">Registriert seit</th>
                <td>{formatDate(report.reported.created_at)}</td>
              </tr>
              <tr>
                <th scope="row">Status</th>
                <td>
                  {report.reported.is_active ? (
                    <span className="badge badge-active">aktiv</span>
                  ) : (
                    <span className="badge badge-blocked">gesperrt</span>
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">Meldungen gegen dieses Profil (gesamt)</th>
                <td>{totalReports ?? "–"}</td>
              </tr>
            </tbody>
          </table>

          <h2>Aktionen</h2>
          <div className="action-grid">
            {report.reported.is_active ? (
              <div className="action-card">
                <h3>Profil sperren</h3>
                <p className="form-hint">
                  Das Profil verschwindet sofort aus dem Entdecken-Feed der App.
                </p>
                <ActionForm
                  action={blockProfileAction}
                  confirmMessage={`Möchten Sie das Profil „${report.reported.display_name}" wirklich sperren?`}
                >
                  <input type="hidden" name="report_id" value={report.id} />
                  <input type="hidden" name="profile_id" value={report.reported.id} />
                  <div className="form-row">
                    <label htmlFor="reason">Begründung *</label>
                    <textarea
                      id="reason"
                      name="reason"
                      rows={3}
                      required
                      maxLength={600}
                      placeholder="Die Begründung wird nur im Audit-Log gespeichert."
                    />
                  </div>
                  <button type="submit" className="button button-danger">
                    Sperren
                  </button>
                </ActionForm>
              </div>
            ) : (
              <div className="action-card">
                <h3>Profil entsperren</h3>
                <ActionForm
                  action={unblockProfileAction}
                  confirmMessage={`Möchten Sie das Profil „${report.reported.display_name}" wirklich entsperren?`}
                >
                  <input type="hidden" name="report_id" value={report.id} />
                  <input type="hidden" name="profile_id" value={report.reported.id} />
                  <button type="submit" className="button button-secondary">
                    Entsperren
                  </button>
                </ActionForm>
              </div>
            )}

            {!report.is_resolved ? (
              <div className="action-card">
                <h3>Meldung abschließen</h3>
                <ActionForm
                  action={resolveReportAction}
                  confirmMessage="Möchten Sie diese Meldung wirklich als erledigt markieren?"
                >
                  <input type="hidden" name="report_id" value={report.id} />
                  <button type="submit" className="button button-primary">
                    Als erledigt markieren
                  </button>
                </ActionForm>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <p className="muted">Das gemeldete Profil existiert nicht mehr.</p>
      )}
    </>
  );
}
