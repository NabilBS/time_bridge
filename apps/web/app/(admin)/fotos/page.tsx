import Link from "next/link";

import { formatDateTime } from "@/lib/dates";
import { roleLabel } from "@/lib/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PhotoSubmissionRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type ProfileJoin = { id: string; display_name: string; role: string; district: string };

export default async function FotosPage() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("photo_submissions")
    .select("*")
    .eq("status", "submitted")
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`Foto-Einreichungen konnten nicht geladen werden: ${error.message}`);
  }
  const rows = (data ?? []) as PhotoSubmissionRow[];

  // Profil-Basisdaten per zweitem Query nachladen (untypisierter Client + Cast).
  const profileIds = Array.from(new Set(rows.map((row) => row.profile_id)));
  const profilesById = new Map<string, ProfileJoin>();
  if (profileIds.length > 0) {
    const { data: profileData, error: profileError } = await admin
      .from("profiles")
      .select("id, display_name, role, district")
      .in("id", profileIds);
    if (profileError) {
      throw new Error(`Profile konnten nicht geladen werden: ${profileError.message}`);
    }
    for (const profile of (profileData ?? []) as ProfileJoin[]) {
      profilesById.set(profile.id, profile);
    }
  }

  return (
    <>
      <h1>Offene Foto-Einreichungen</h1>

      {rows.length === 0 ? (
        <p className="table-empty">Keine offenen Einreichungen vorhanden.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Eingereicht am</th>
              <th>Profil</th>
              <th>Rolle</th>
              <th>Bezirk</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const profile = profilesById.get(row.profile_id);
              return (
                <tr key={row.id}>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{profile?.display_name ?? "–"}</td>
                  <td>{profile ? roleLabel(profile.role) : "–"}</td>
                  <td>{profile?.district ?? "–"}</td>
                  <td>
                    <Link href={`/fotos/${row.id}`}>Prüfen</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
