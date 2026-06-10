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
