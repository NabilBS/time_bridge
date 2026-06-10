import Link from "next/link";

import { formatDateTime } from "@/lib/dates";
import { reportReasonLabel } from "@/lib/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReportRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type ReportListRow = ReportRow & {
  reporter: { display_name: string } | null;
  reported: { display_name: string; is_active: boolean } | null;
};

export default async function MeldungenPage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reports")
    .select(
      "*, reporter:profiles!reports_reporter_profile_fkey(display_name), reported:profiles!reports_reported_profile_fkey(display_name, is_active)",
    )
    .eq("is_resolved", false)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`Meldungen konnten nicht geladen werden: ${error.message}`);
  }
  const rows = (data ?? []) as ReportListRow[];

  return (
    <>
      <h1>Offene Meldungen</h1>

      {rows.length === 0 ? (
        <p className="table-empty">Keine offenen Meldungen vorhanden.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Gemeldet am</th>
              <th>Gemeldetes Profil</th>
              <th>Gemeldet von</th>
              <th>Grund</th>
              <th>Status Profil</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatDateTime(row.created_at)}</td>
                <td>{row.reported?.display_name ?? "–"}</td>
                <td>{row.reporter?.display_name ?? "–"}</td>
                <td>{reportReasonLabel(row.reason)}</td>
                <td>
                  {row.reported ? (
                    row.reported.is_active ? (
                      <span className="badge badge-active">aktiv</span>
                    ) : (
                      <span className="badge badge-blocked">gesperrt</span>
                    )
                  ) : (
                    "–"
                  )}
                </td>
                <td>
                  <Link href={`/meldungen/${row.id}`}>Bearbeiten</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
