import Link from "next/link";

import { formatDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PartnerLocationRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PartnerOrtePage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_locations")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    throw new Error(`Partner-Orte konnten nicht geladen werden: ${error.message}`);
  }
  const rows = (data ?? []) as PartnerLocationRow[];

  return (
    <>
      <h1>Partner-Orte</h1>

      <div className="page-actions" style={{ marginBottom: "var(--space-4)" }}>
        <Link href="/partner-orte/neu" className="button button-primary">
          Neuen Partner-Ort anlegen
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="table-empty">Noch keine Partner-Orte angelegt.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Art</th>
              <th>Bezirk</th>
              <th>Adresse</th>
              <th>Verifiziert</th>
              <th>Angelegt am</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.kind}</td>
                <td>{row.district}</td>
                <td>{row.address}</td>
                <td>
                  {row.is_verified ? (
                    <span className="badge badge-verified">Ja</span>
                  ) : (
                    <span className="muted">Nein</span>
                  )}
                </td>
                <td>{formatDate(row.created_at)}</td>
                <td>
                  <Link href={`/partner-orte/${row.id}`}>Bearbeiten</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
