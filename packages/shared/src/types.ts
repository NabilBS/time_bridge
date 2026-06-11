import { z } from "zod";

import { BERLIN_DISTRICTS } from "./constants";

export const VerificationType = z.enum([
  "video_ident",
  "background_check",
  "first_aid_child",
  "training_course",
  "partner_reference",
]);
export type VerificationType = z.infer<typeof VerificationType>;

export const VerificationStatus = z.enum(["submitted", "approved", "rejected", "expired"]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const VerificationSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  type: VerificationType,
  status: VerificationStatus,
  document_path: z.string().nullable(),
  valid_until: z.string().nullable(),
  review_note: z.string().nullable(),
  created_at: z.string(),
});
export type Verification = z.infer<typeof VerificationSchema>;

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  video_ident: "Video-Ident",
  background_check: "Erweitertes Führungszeugnis",
  first_aid_child: "Erste-Hilfe-am-Kind-Kurs",
  training_course: "Schulungsnachweis (z. B. VHS)",
  partner_reference: "Referenz eines Partner-Orts",
};

/** Pfad-Konvention im Bucket verification-docs – beide Agenten halten sich daran. */
export const verificationDocPath = (userId: string, verificationId: string, ext: string) =>
  `${userId}/${verificationId}.${ext}`;

export const MatchRequestStatus = z.enum(["pending", "accepted", "declined", "withdrawn"]);
export type MatchRequestStatus = z.infer<typeof MatchRequestStatus>;

export const MatchRequestSchema = z.object({
  id: z.string().uuid(),
  from_profile: z.string().uuid(),
  to_profile: z.string().uuid(),
  message: z.string().max(600).nullable(),
  status: MatchRequestStatus,
  created_at: z.string(),
  responded_at: z.string().nullable(),
});
export type MatchRequest = z.infer<typeof MatchRequestSchema>;

export const MatchSchema = z.object({
  id: z.string().uuid(),
  profile_a: z.string().uuid(),
  profile_b: z.string().uuid(),
  created_at: z.string(),
});
export type Match = z.infer<typeof MatchSchema>;

/** Annahme läuft NUR über diese RPC – nie per direktem Update. */
export const RPC_ACCEPT_REQUEST = "accept_match_request";

export const CreateMatchRequestSchema = z.object({
  to_profile: z.string().uuid(),
  message: z
    .string()
    .trim()
    .max(600, "Ihre Nachricht darf höchstens 600 Zeichen lang sein.")
    .nullable(),
});
export type CreateMatchRequest = z.infer<typeof CreateMatchRequestSchema>;

export const SearchFilterSchema = z.object({
  district: z.enum(BERLIN_DISTRICTS).nullable().default(null),
  min_trust_level: z.number().int().min(1).max(3).default(1),
  interests: z.array(z.string().trim().min(1)).default([]),
});
export type SearchFilter = z.infer<typeof SearchFilterSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  match_id: z.string().uuid(),
  sender_profile: z.string().uuid(),
  body: z.string().min(1).max(2000),
  created_at: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const REPORT_REASONS = [
  { id: "inappropriate", label: "Unangemessenes Verhalten" },
  { id: "safety", label: "Sicherheitsbedenken" },
  { id: "fake", label: "Falsche Angaben oder fremdes Profil" },
  { id: "other", label: "Etwas anderes" },
] as const;
export type ReportReasonId = (typeof REPORT_REASONS)[number]["id"];

/* ------------------------------------------------------------------ */
/* Auftrag 005 – Treffen am Partner-Ort & Bewertungen                  */
/* ------------------------------------------------------------------ */

export const PartnerKind = z.enum([
  "mehrgenerationenhaus",
  "stadtteilzentrum",
  "familienzentrum",
  "bibliothek",
  "nachbarschaftstreff",
  "gemeindezentrum",
]);
export type PartnerKind = z.infer<typeof PartnerKind>;

export const PARTNER_KIND_LABELS: Record<PartnerKind, string> = {
  mehrgenerationenhaus: "Mehrgenerationenhaus",
  stadtteilzentrum: "Stadtteilzentrum",
  familienzentrum: "Familienzentrum",
  bibliothek: "Bibliothek",
  nachbarschaftstreff: "Nachbarschaftstreff",
  gemeindezentrum: "Gemeindezentrum",
};

export const MeetingStatus = z.enum(["planned", "completed", "cancelled"]);
export type MeetingStatus = z.infer<typeof MeetingStatus>;

export const MeetingSchema = z.object({
  id: z.string().uuid(),
  match_id: z.string().uuid(),
  partner_location_id: z.string().uuid().nullable(),
  scheduled_at: z.string(),
  status: MeetingStatus,
  created_at: z.string(),
});
export type Meeting = z.infer<typeof MeetingSchema>;

export const PartnerLocationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: PartnerKind,
  street: z.string().nullable(),
  postal_code: z.string().nullable(),
  district: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  is_verified: z.boolean(),
});
export type PartnerLocation = z.infer<typeof PartnerLocationSchema>;

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().uuid(),
  reviewer_id: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(600).nullable(),
  created_at: z.string(),
});
export type Review = z.infer<typeof ReviewSchema>;

/** Aggregierte Bewertungen eines Profils – nur über diese RPC, nie per Join. */
export const RPC_REVIEW_STATS = "review_stats";

export const CreateReviewSchema = z.object({
  meeting_id: z.string().uuid(),
  stars: z.number().int().min(1, "Bitte vergeben Sie mindestens einen Stern.").max(5),
  comment: z
    .string()
    .trim()
    .max(600, "Ihr Kommentar darf höchstens 600 Zeichen lang sein.")
    .nullable(),
});
export type CreateReview = z.infer<typeof CreateReviewSchema>;

/* ------------------------------------------------------------------ */
/* Auftrag 006 – Benachrichtigungen                                    */
/* ------------------------------------------------------------------ */

export const NotificationKind = z.enum([
  "request_received", // Neue Anfrage
  "request_accepted", // Anfrage angenommen → Chat offen
  "message_received", // Neue Nachricht (ohne Inhalt!)
  "verification_decided", // approved / rejected / expired
  "meeting_reminder", // 24 h vor scheduled_at
]);
export type NotificationKind = z.infer<typeof NotificationKind>;

/** Schalter je Kategorie; fehlender Schlüssel = an. */
export const NotificationPrefsSchema = z.object({
  request_received: z.boolean().optional(),
  request_accepted: z.boolean().optional(),
  message_received: z.boolean().optional(),
  verification_decided: z.boolean().optional(),
  meeting_reminder: z.boolean().optional(),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefsSchema>;

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationKind, string> = {
  request_received: "Neue Anfragen",
  request_accepted: "Angenommene Anfragen",
  message_received: "Neue Nachrichten",
  verification_decided: "Entscheidungen zu Nachweisen",
  meeting_reminder: "Erinnerungen an Treffen",
};

/* ------------------------------------------------------------------ */
/* Auftrag 007 – Launch-Härtung                                        */
/* ------------------------------------------------------------------ */

/** Konto-Löschung läuft NUR über diese RPC – nie über direkte Deletes. */
export const RPC_DELETE_ACCOUNT = "delete_account";

/* ------------------------------------------------------------------ */
/* Auftrag 008 – Wirkungsmessung                                       */
/* ------------------------------------------------------------------ */

export const SurveyKind = z.enum([
  "nps", // "Würden Sie Zeitbrücke weiterempfehlen?" – Skala 0–10
  "wellbeing_senior", // "Fühlen Sie sich durch Zeitbrücke weniger allein?" – Skala 1–5
  "relief_family", // "Entlastet Zeitbrücke Ihren Familienalltag?" – Skala 1–5
]);
export type SurveyKind = z.infer<typeof SurveyKind>;

export const SurveySchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  kind: SurveyKind,
  score: z.number().int().min(0).max(10), // Bedeutung je kind, s. Enum
  comment: z.string().max(600).nullable(),
  created_at: z.string(),
});
export type Survey = z.infer<typeof SurveySchema>;
