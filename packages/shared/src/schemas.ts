import { z } from "zod";

import {
  BERLIN_DISTRICTS,
  BIO_MAX_LENGTH,
  BIRTH_YEAR_MAX,
  BIRTH_YEAR_MIN,
  CARE_WISHES_MAX_LENGTH,
  CHILD_AGE_MAX,
  CHILD_AGE_MIN,
  CHILDREN_COUNT_MAX,
  CHILDREN_COUNT_MIN,
} from "./constants";

export const RoleSchema = z.enum(["senior", "family"]);
export type Role = z.infer<typeof RoleSchema>;

export const PostalCodeSchema = z
  .string()
  .regex(/^\d{5}$/, "Bitte geben Sie eine gültige Postleitzahl ein (5 Ziffern).");

export const ProfileSchema = z
  .object({
    id: z.string().uuid(),
    role: RoleSchema,
    display_name: z
      .string()
      .trim()
      .min(2, "Bitte geben Sie Ihren Anzeigenamen ein.")
      .max(60, "Der Anzeigename darf höchstens 60 Zeichen lang sein."),
    birth_year: z
      .number()
      .int()
      .min(BIRTH_YEAR_MIN, "Bitte wählen Sie Ihr Geburtsjahr.")
      .max(BIRTH_YEAR_MAX, "Bitte wählen Sie Ihr Geburtsjahr."),
    interests: z
      .array(z.string().trim().min(1).max(60))
      .max(20, "Bitte wählen Sie höchstens 20 Interessen.")
      .default([]),
    district: z.enum(BERLIN_DISTRICTS, {
      errorMap: () => ({ message: "Bitte wählen Sie Ihren Bezirk." }),
    }),
    postal_code: PostalCodeSchema,
    bio: z
      .string()
      .trim()
      .max(BIO_MAX_LENGTH, "Die Kurzvorstellung darf höchstens 600 Zeichen lang sein.")
      .optional()
      .nullable(),
  })
  .superRefine((profile, ctx) => {
    if (profile.role === "senior" && profile.interests.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["interests"],
        message: "Bitte wählen Sie mindestens ein Interesse.",
      });
    }
  });

export type Profile = z.infer<typeof ProfileSchema>;

export const FamilyDetailsSchema = z
  .object({
    profile_id: z.string().uuid(),
    children_count: z.number().int().min(CHILDREN_COUNT_MIN).max(CHILDREN_COUNT_MAX),
    age_min: z.number().int().min(CHILD_AGE_MIN).max(CHILD_AGE_MAX),
    age_max: z.number().int().min(CHILD_AGE_MIN).max(CHILD_AGE_MAX),
    care_wishes: z
      .string()
      .trim()
      .min(1, "Bitte beschreiben Sie kurz, wobei Sie sich Unterstützung wünschen.")
      .max(
        CARE_WISHES_MAX_LENGTH,
        "Ihr Wunsch darf höchstens 600 Zeichen lang sein.",
      ),
  })
  .superRefine((details, ctx) => {
    if (details.age_max < details.age_min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["age_max"],
        message: "Das höchste Alter darf nicht kleiner als das niedrigste sein.",
      });
    }
  });

export type FamilyDetails = z.infer<typeof FamilyDetailsSchema>;

const TimeStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const AvailabilitySchema = z
  .object({
    profile_id: z.string().uuid(),
    weekday: z.number().int().min(0).max(6),
    time_from: TimeStringSchema,
    time_to: TimeStringSchema,
  })
  .superRefine((availability, ctx) => {
    if (availability.time_to <= availability.time_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["time_to"],
        message: "Das Zeitfenster muss nach dem Beginn enden.",
      });
    }
  });

export type Availability = z.infer<typeof AvailabilitySchema>;
