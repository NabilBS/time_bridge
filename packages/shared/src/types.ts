import { z } from "zod";

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
