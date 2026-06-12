export const BERLIN_DISTRICTS = [
  "Charlottenburg-Wilmersdorf",
  "Friedrichshain-Kreuzberg",
  "Lichtenberg",
  "Marzahn-Hellersdorf",
  "Mitte",
  "Neukölln",
  "Pankow",
  "Reinickendorf",
  "Spandau",
  "Steglitz-Zehlendorf",
  "Tempelhof-Schöneberg",
  "Treptow-Köpenick",
] as const;

export type BerlinDistrict = (typeof BERLIN_DISTRICTS)[number];

export const INTEREST_SUGGESTIONS = [
  "Vorlesen",
  "Hausaufgaben",
  "Backen",
  "Werken",
  "Spielplatz",
  "Gesellschaftsspiele",
  "Musik",
  "Sprachen",
  "Sport",
  "Natur",
] as const;

export const TIME_SLOTS = [
  { id: "morning", label: "Vormittag", timeFrom: "09:00", timeTo: "12:00" },
  { id: "afternoon", label: "Nachmittag", timeFrom: "14:00", timeTo: "18:00" },
  { id: "early_evening", label: "Früher Abend", timeFrom: "17:00", timeTo: "20:00" },
] as const;

export type TimeSlotId = (typeof TIME_SLOTS)[number]["id"];

export const WEEKDAYS = [
  { value: 0, short: "Mo", label: "Montag" },
  { value: 1, short: "Di", label: "Dienstag" },
  { value: 2, short: "Mi", label: "Mittwoch" },
  { value: 3, short: "Do", label: "Donnerstag" },
  { value: 4, short: "Fr", label: "Freitag" },
  { value: 5, short: "Sa", label: "Samstag" },
  { value: 6, short: "So", label: "Sonntag" },
] as const;

export const BIRTH_YEAR_MIN = 1920;
// Zeitbrücke ist für Erwachsene (ab 18) – verschärft mit Auftrag 007.
export const BIRTH_YEAR_MAX = 2008;

export const CHILDREN_COUNT_MIN = 1;
export const CHILDREN_COUNT_MAX = 10;
export const CHILD_AGE_MIN = 0;
export const CHILD_AGE_MAX = 17;

export const CARE_WISHES_MAX_LENGTH = 600;
export const BIO_MAX_LENGTH = 600;
