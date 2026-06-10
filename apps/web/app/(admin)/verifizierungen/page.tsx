import Link from "next/link";

import { VERIFICATION_TYPE_LABELS, VerificationType } from "@zeitbruecke/shared";

import { formatDateTime } from "@/lib/dates";
import { roleLabel } from "@/lib/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import type { VerificationRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type VerificationListRow = VerificationRow & {
  profiles: { display_name: string; role: string } | null;
};

export default async function VerifizierungenPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const parsedType = VerificationType.safeParse(type);
  const typeFilter = parsedType.success ? parsedType.data : null;

  const admin = createAdminClient();
  let query = admin
    .from("verifications")
    .select("*, profiles(display_name, role)")
    .eq("status", "submitted")
    .order("created_at", { ascending: true });
  if (typeFilter) {
    query = query.eq("type", typeFilter);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Verifizierungen konnten nicht geladen werden: ${error.message}`);
  }
  const rows = (data ?? []) as VerificationListRow[];

  return (
    <>
      <h1>Offene Verifizierungen</h1>

      <nav className="filter" aria-label="Nach Typ filtern">
        <Link href="/verifizierungen" className={typeFilter === null ? "filter-active" : ""}>
          Alle
        </Link>
        {VerificationType.options.map((option) => (
          <Link
            key={option}
            href={`/verifizierungen?type=${option}`}
            className={typeFilter === option ? "filter-active" : ""}
          >
            {VERIFICATION_TYPE_LABELS[option]}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="table-empty">Keine offenen Einreichungen vorhanden.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Eingereicht am</th>
              <th>Typ</th>
              <th>Profil</th>
              <th>Rolle</th>
              <th>Dokument</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatDateTime(row.created_at)}</td>
                <td>{VERIFICATION_TYPE_LABELS[row.type]}</td>
                <td>{row.profiles?.display_name ?? "–"}</td>
                <td>{row.profiles ? roleLabel(row.profiles.role) : "–"}</td>
                <td>{row.document_path ? "vorhanden" : "–"}</td>
                <td>
                  <Link href={`/verifizierungen/${row.id}`}>Prüfen</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
