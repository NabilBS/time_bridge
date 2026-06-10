const WEEKDAY_NAMES = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** z. B. „Montag, 12. Mai, 15:30 Uhr" */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return (
    `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()}. ${MONTH_NAMES[date.getMonth()]}, ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())} Uhr`
  );
}

/** z. B. „12. Mai 2026" */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()}. ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}
