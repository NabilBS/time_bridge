import { BERLIN_DISTRICTS } from "@zeitbruecke/shared";

import { formatDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  KpiFunnelWeeklyRow,
  KpiMeetingsWeeklyRow,
  KpiProfilesWeeklyRow,
  KpiRetentionRow,
  KpiSeniorsByTrustRow,
  KpiSurveysWeeklyRow,
} from "@/lib/types";

import { BarChart, ChartLegend, type ChartSeries } from "./BarChart";

export const dynamic = "force-dynamic";

/** Pilotziele aus dem Businessplan (Auftrag 008). */
const PILOT_GOALS = {
  verifiedSeniors: 50,
  families: 150,
  completedMeetings: 100,
} as const;

const KPI_EXPORT_VIEWS = [
  { view: "kpi_profiles_weekly", label: "Neue Profile je Woche" },
  { view: "kpi_seniors_by_trust", label: "Senioren je Vertrauensstufe" },
  { view: "kpi_funnel_weekly", label: "Funnel je Woche" },
  { view: "kpi_meetings_weekly", label: "Treffen je Woche" },
  { view: "kpi_retention", label: "Wiederkehrende Treffen" },
  { view: "kpi_surveys_weekly", label: "Befragungen je Woche" },
] as const;

/** Anzahl der Wochen, die die Verlaufs-Charts maximal zeigen. */
const MAX_WEEKS = 12;

const weekLabelFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

function formatWeekShort(week: string): string {
  return weekLabelFormatter.format(new Date(week));
}

/** Null (Zelle unter 5) als „–" rendern, nie als 0. */
function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : value.toLocaleString("de-DE");
}

/**
 * Summe über maskierte Zellen: null-Zellen werden ausgelassen (nicht als 0
 * gezählt); `masked` meldet, ob mindestens eine Zelle ausgelassen wurde –
 * die Summe hat dann „mindestens"-Charakter.
 */
function maskedSum(values: (number | null)[]): { sum: number; masked: boolean } {
  let sum = 0;
  let masked = false;
  for (const value of values) {
    if (value === null) {
      masked = true;
    } else {
      sum += value;
    }
  }
  return { sum, masked };
}

function formatMaskedSum(rowsExist: boolean, { sum, masked }: { sum: number; masked: boolean }): string {
  if (!rowsExist || (sum === 0 && masked)) return "–";
  return `${masked ? "mind. " : ""}${sum.toLocaleString("de-DE")}`;
}

function lastWeeks(rows: { week: string }[]): string[] {
  return [...new Set(rows.map((row) => row.week))].sort().slice(-MAX_WEEKS);
}

function ProgressRow({ label, value, goal }: { label: string; value: number; goal: number }) {
  const reached = value >= goal;
  const pct = Math.min(100, Math.round((value / goal) * 100));
  return (
    <div className="progress-row">
      <div className="progress-label">
        <span>{label}</span>
        <span>
          mind. {value.toLocaleString("de-DE")} von {goal.toLocaleString("de-DE")}
          {reached ? " – Ziel erreicht" : ""}
        </span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(value, goal)}
      >
        <div
          className={reached ? "progress-fill progress-done" : "progress-fill"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function KennzahlenPage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string }>;
}) {
  const { district: districtParam } = await searchParams;
  const district = (BERLIN_DISTRICTS as readonly string[]).includes(districtParam ?? "")
    ? (districtParam as string)
    : null;

  const admin = createAdminClient();
  const [profilesRes, seniorsRes, funnelRes, meetingsRes, retentionRes, npsRes] = await Promise.all([
    admin.from("kpi_profiles_weekly").select("*").order("week", { ascending: true }),
    admin.from("kpi_seniors_by_trust").select("*").order("trust_level", { ascending: true }),
    admin.from("kpi_funnel_weekly").select("*").order("week", { ascending: true }),
    admin.from("kpi_meetings_weekly").select("*").order("week", { ascending: true }),
    admin.from("kpi_retention").select("*"),
    admin.from("kpi_surveys_weekly").select("*").eq("kind", "nps").order("week", { ascending: false }),
  ]);
  for (const res of [profilesRes, seniorsRes, funnelRes, meetingsRes, retentionRes, npsRes]) {
    if (res.error) {
      throw new Error(`Kennzahlen konnten nicht geladen werden: ${res.error.message}`);
    }
  }

  const profileRows = (profilesRes.data ?? []) as KpiProfilesWeeklyRow[];
  const seniorRows = (seniorsRes.data ?? []) as KpiSeniorsByTrustRow[];
  const funnelRows = (funnelRes.data ?? []) as KpiFunnelWeeklyRow[];
  const meetingRows = (meetingsRes.data ?? []) as KpiMeetingsWeeklyRow[];
  const retention = ((retentionRes.data ?? [])[0] ?? null) as KpiRetentionRow | null;
  const npsRows = (npsRes.data ?? []) as KpiSurveysWeeklyRow[];

  /* Kopfzahlen */
  const seniorsByLevel = new Map(seniorRows.map((row) => [row.trust_level, row.seniors]));
  const completedTotal = maskedSum(meetingRows.map((row) => row.completed));
  const latestNps = npsRows.find((row) => row.nps !== null) ?? null;

  /* Kontrollmetrik: jüngste Woche mit ausgewiesenem Wert */
  const partnerPct =
    [...meetingRows]
      .reverse()
      .map((row) => row.first_meeting_partner_pct)
      .find((value): value is number => value !== null) ?? null;

  /* Neue Profile je Woche – einzige View mit Bezirk, hier greift der Filter.
   * Null-Zellen (n < 5) werden je Woche ausgelassen, nicht als 0 summiert;
   * eine Woche nur aus maskierten Zellen bleibt „–". */
  const filteredProfiles = district
    ? profileRows.filter((row) => row.district === district)
    : profileRows;
  const profilesByWeek = new Map<string, number | null>();
  for (const row of filteredProfiles) {
    if (row.new_profiles === null) {
      if (!profilesByWeek.has(row.week)) profilesByWeek.set(row.week, null);
    } else {
      profilesByWeek.set(row.week, (profilesByWeek.get(row.week) ?? 0) + row.new_profiles);
    }
  }
  const profileWeeks = lastWeeks(filteredProfiles);
  const profileSeries: ChartSeries[] = [
    {
      label: "Neue Profile",
      color: "var(--color-fichte)",
      values: profileWeeks.map((week) => profilesByWeek.get(week) ?? null),
    },
  ];

  /* Funnel je Woche */
  const funnelWeeks = lastWeeks(funnelRows);
  const funnelByWeek = new Map(funnelRows.map((row) => [row.week, row]));
  const funnelSeries: ChartSeries[] = [
    {
      label: "Anfragen",
      color: "var(--color-muted)",
      values: funnelWeeks.map((week) => funnelByWeek.get(week)?.requests ?? null),
    },
    {
      label: "Angenommen",
      color: "var(--color-gold)",
      values: funnelWeeks.map((week) => funnelByWeek.get(week)?.accepted ?? null),
    },
    {
      label: "Matches",
      color: "var(--color-fichte)",
      values: funnelWeeks.map((week) => funnelByWeek.get(week)?.matches ?? null),
    },
  ];

  /* Treffen je Woche */
  const meetingWeeks = lastWeeks(meetingRows);
  const meetingsByWeek = new Map(meetingRows.map((row) => [row.week, row]));
  const meetingSeries: ChartSeries[] = [
    {
      label: "Geplant",
      color: "var(--color-muted)",
      values: meetingWeeks.map((week) => meetingsByWeek.get(week)?.planned ?? null),
    },
    {
      label: "Abgeschlossen",
      color: "var(--color-fichte)",
      values: meetingWeeks.map((week) => meetingsByWeek.get(week)?.completed ?? null),
    },
    {
      label: "Abgesagt",
      color: "var(--color-danger)",
      values: meetingWeeks.map((week) => meetingsByWeek.get(week)?.cancelled ?? null),
    },
  ];

  /* Pilotziele – maskierte Zellen zählen hier als 0, die Werte sind daher
   * Untergrenzen („mind. X"). */
  const verifiedSeniors = seniorRows
    .filter((row) => row.trust_level >= 2)
    .reduce((acc, row) => acc + (row.seniors ?? 0), 0);
  const familiesTotal = maskedSum(
    profileRows.filter((row) => row.role === "family").map((row) => row.new_profiles),
  ).sum;

  return (
    <>
      <h1>Kennzahlen</h1>
      <p className="muted">
        Alle Werte sind Aggregate aus den KPI-Views – ein Drill-Down auf einzelne Personen ist
        bewusst nicht vorgesehen. Zellen mit weniger als 5 Fällen werden aus Datenschutzgründen
        nicht ausgewiesen und erscheinen als „–".
      </p>

      <section className="kpi-grid" aria-label="Kopfzahlen">
        <div className="kpi-card">
          <h3>Aktive Senioren je Vertrauensstufe</h3>
          <ul className="kpi-list">
            {[1, 2, 3].map((level) => (
              <li key={level}>
                <span>Stufe {level}</span>
                <strong>{formatCount(seniorsByLevel.get(level))}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="kpi-card">
          <h3>Matches gesamt</h3>
          <p className="kpi-value">{formatCount(retention?.total_matches)}</p>
          <p className="kpi-sub">
            davon mit mindestens 2 abgeschlossenen Treffen:{" "}
            {formatCount(retention?.matches_with_two_completed)}
          </p>
        </div>
        <div className="kpi-card">
          <h3>Abgeschlossene Treffen gesamt</h3>
          <p className="kpi-value">{formatMaskedSum(meetingRows.length > 0, completedTotal)}</p>
          {completedTotal.masked ? (
            <p className="kpi-sub">Untergrenze – einzelne Wochen sind maskiert.</p>
          ) : null}
        </div>
        <div className="kpi-card">
          <h3>NPS aktuell</h3>
          <p className="kpi-value">{latestNps ? formatCount(latestNps.nps) : "–"}</p>
          <p className="kpi-sub">
            {latestNps
              ? `Woche ab ${formatDate(latestNps.week)}`
              : "Noch keine ausreichende Antwortzahl."}
          </p>
        </div>
      </section>

      <h2>Pilotziele</h2>
      <section className="kpi-card" aria-label="Fortschritt gegen die Pilotziele">
        <ProgressRow
          label="Verifizierte Senioren (Stufe 2 oder 3)"
          value={verifiedSeniors}
          goal={PILOT_GOALS.verifiedSeniors}
        />
        <ProgressRow label="Familien" value={familiesTotal} goal={PILOT_GOALS.families} />
        <ProgressRow
          label="Abgeschlossene Treffen"
          value={completedTotal.sum}
          goal={PILOT_GOALS.completedMeetings}
        />
        <p className="footnote">
          Zellen unter 5 werden aus Datenschutzgründen nicht ausgewiesen. Die Fortschrittswerte
          sind deshalb Untergrenzen („mind.") – der tatsächliche Stand kann darüber liegen.
        </p>
      </section>

      <h2>Wochen-Verlauf</h2>
      <p className="muted">Die Diagramme zeigen die letzten {MAX_WEEKS} Wochen mit Daten.</p>

      <section className="chart-card" aria-label="Neue Profile je Woche">
        <h3>Neue Profile je Woche{district ? ` – ${district}` : " – alle Bezirke"}</h3>
        <form method="get" className="filter-form">
          <label htmlFor="district">Bezirk</label>
          <select id="district" name="district" defaultValue={district ?? ""}>
            <option value="">Alle Bezirke</option>
            {BERLIN_DISTRICTS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <button type="submit" className="button button-secondary">
            Filter anwenden
          </button>
        </form>
        <BarChart
          weekLabels={profileWeeks.map(formatWeekShort)}
          series={profileSeries}
          ariaLabel="Balkendiagramm: neue Profile je Woche"
        />
        <ChartLegend series={profileSeries} />
      </section>

      <section className="chart-card" aria-label="Funnel je Woche">
        <h3>Funnel je Woche</h3>
        <BarChart
          weekLabels={funnelWeeks.map(formatWeekShort)}
          series={funnelSeries}
          ariaLabel="Balkendiagramm: Anfragen, angenommene Anfragen und Matches je Woche"
        />
        <ChartLegend series={funnelSeries} />
      </section>

      <section className="chart-card" aria-label="Treffen je Woche">
        <h3>Treffen je Woche</h3>
        <BarChart
          weekLabels={meetingWeeks.map(formatWeekShort)}
          series={meetingSeries}
          ariaLabel="Balkendiagramm: geplante, abgeschlossene und abgesagte Treffen je Woche"
        />
        <ChartLegend series={meetingSeries} />
        <p className="kpi-sub">
          Erst-Treffen an Partner-Orten:{" "}
          {partnerPct === null ? "–" : `${partnerPct.toLocaleString("de-DE")} %`} – Soll: 100 %
        </p>
      </section>

      <h2>CSV-Export</h2>
      <p className="muted">
        Je View eine Datei (UTF-8 mit BOM, Semikolon-getrennt – öffnet direkt in Excel).
      </p>
      <ul className="export-list">
        {KPI_EXPORT_VIEWS.map((entry) => (
          <li key={entry.view}>
            <a href={`/kennzahlen/export/${entry.view}`}>
              {entry.label} ({entry.view}.csv)
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
