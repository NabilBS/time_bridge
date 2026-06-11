import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface ExportConfig {
  /** Feste Spaltenliste: stabiler CSV-Header auch bei 0 Zeilen. */
  columns: string[];
  /** Sortierung für deterministische Exporte. */
  orderBy: string[];
}

/** Allowlist der exportierbaren KPI-Views – alles andere → 404. */
const KPI_EXPORTS: Record<string, ExportConfig> = {
  kpi_profiles_weekly: {
    columns: ["week", "role", "district", "new_profiles"],
    orderBy: ["week", "role", "district"],
  },
  kpi_seniors_by_trust: {
    columns: ["trust_level", "seniors"],
    orderBy: ["trust_level"],
  },
  kpi_funnel_weekly: {
    columns: ["week", "requests", "accepted", "matches", "matches_with_completed_meeting"],
    orderBy: ["week"],
  },
  kpi_meetings_weekly: {
    columns: ["week", "planned", "completed", "cancelled", "first_meeting_partner_pct"],
    orderBy: ["week"],
  },
  kpi_retention: {
    columns: ["total_matches", "matches_with_two_completed"],
    orderBy: [],
  },
  kpi_surveys_weekly: {
    columns: ["week", "kind", "responses", "avg_score", "nps"],
    orderBy: ["week", "kind"],
  },
};

/** Semikolon-Separator für Excel; null → leeres Feld; Anführungszeichen verdoppeln. */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[";\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ view: string }> },
) {
  // Zugriffsschutz wie überall im Admin: Session + Allowlist. redirect()
  // aus requireAdmin() funktioniert auch in Route Handlern (→ /login bzw. /403).
  await requireAdmin();

  const { view } = await context.params;
  const config = Object.prototype.hasOwnProperty.call(KPI_EXPORTS, view)
    ? KPI_EXPORTS[view]
    : null;
  if (!config) {
    return new Response("Nicht gefunden", { status: 404 });
  }

  const admin = createAdminClient();
  let query = admin.from(view).select("*");
  for (const column of config.orderBy) {
    query = query.order(column, { ascending: true });
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Export von ${view} fehlgeschlagen: ${error.message}`);
  }
  const rows = (data ?? []) as Record<string, unknown>[];

  const lines = [config.columns.join(";")];
  for (const row of rows) {
    lines.push(config.columns.map((column) => csvField(row[column])).join(";"));
  }
  // UTF-8 mit BOM (\uFEFF), damit Excel Umlaute korrekt erkennt.
  const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${view}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
