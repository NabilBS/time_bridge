import type {
  BerlinDistrict,
  PartnerKind,
  Role,
  VerificationStatus,
  VerificationType,
} from "@zeitbruecke/shared";

/** Ergebnis-Typ aller Server Actions, die über <ActionForm> laufen. */
export type ActionState = {
  error: string | null;
};

export const INITIAL_ACTION_STATE: ActionState = { error: null };

/* Lokale Zeilen-Interfaces – wir arbeiten mit untypisierten Supabase-Clients
 * und casten Abfrage-Ergebnisse auf diese Formen (kein generierter DB-Typ). */

export interface VerificationRow {
  id: string;
  profile_id: string;
  type: VerificationType;
  status: VerificationStatus;
  document_path: string | null;
  valid_until: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface PhotoSubmissionRow {
  id: string;
  profile_id: string;
  storage_path: string;
  status: VerificationStatus;
  review_note: string | null;
  created_at: string;
}

export interface ProfileBasics {
  id: string;
  display_name: string;
  role: Role;
  district: string;
  trust_level: number;
  is_active: boolean;
  created_at: string;
}

export interface ReportRow {
  id: string;
  reporter_profile: string;
  reported_profile: string;
  reason: string;
  details: string | null;
  is_resolved: boolean;
  created_at: string;
}

/* KPI-Views aus Auftrag 008 – ausschließlich Aggregate, Zellen mit n < 5
 * liefert die Datenbank als null (im UI als „–" rendern, nie als 0). */

export interface KpiProfilesWeeklyRow {
  week: string;
  role: string;
  district: string | null;
  new_profiles: number | null;
}

export interface KpiSeniorsByTrustRow {
  trust_level: number;
  seniors: number | null;
}

export interface KpiFunnelWeeklyRow {
  week: string;
  requests: number | null;
  accepted: number | null;
  matches: number | null;
  matches_with_completed_meeting: number | null;
}

export interface KpiMeetingsWeeklyRow {
  week: string;
  planned: number | null;
  completed: number | null;
  cancelled: number | null;
  first_meeting_partner_pct: number | null;
}

export interface KpiRetentionRow {
  total_matches: number | null;
  matches_with_two_completed: number | null;
}

export interface KpiSurveysWeeklyRow {
  week: string;
  kind: string;
  responses: number | null;
  avg_score: number | null;
  nps: number | null;
}

export interface PartnerLocationRow {
  id: string;
  name: string;
  kind: PartnerKind;
  street: string | null;
  postal_code: string | null;
  district: BerlinDistrict | string;
  lat: number | null;
  lng: number | null;
  contact: string | null;
  is_verified: boolean;
  created_at: string;
}
