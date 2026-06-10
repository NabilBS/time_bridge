import type {
  BerlinDistrict,
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

export interface PartnerLocationRow {
  id: string;
  name: string;
  kind: string;
  address: string;
  district: BerlinDistrict | string;
  latitude: number | null;
  longitude: number | null;
  contact: string | null;
  is_verified: boolean;
  created_at: string;
}
