const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeZone: "Europe/Berlin",
});

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  return dateTimeFormatter.format(new Date(iso));
}

/** Heutiges Datum als YYYY-MM-DD (UTC – für Vergleiche mit date-Inputs ausreichend). */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Addiert Jahre auf ein YYYY-MM-DD-Datum (29. Februar rollt auf den 1. März). */
export function addYearsToIsoDate(isoDate: string, years: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const result = new Date(Date.UTC(year + years, month - 1, day));
  return result.toISOString().slice(0, 10);
}
