"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { BERLIN_DISTRICTS, PartnerKind } from "@zeitbruecke/shared";

import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/types";
import { firstZodError, formString } from "@/lib/validation";

function optionalCoordinate(min: number, max: number) {
  const message = `Bitte geben Sie eine Zahl zwischen ${min} und ${max} an.`;
  return z.preprocess(
    (value) => {
      if (value == null) return null;
      const text = String(value).trim().replace(",", ".");
      if (text === "") return null;
      const parsed = Number(text);
      return Number.isNaN(parsed) ? text : parsed;
    },
    z.number({ invalid_type_error: message }).min(min, message).max(max, message).nullable(),
  );
}

const PartnerLocationInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Bitte geben Sie einen Namen an.")
    .max(120, "Der Name darf höchstens 120 Zeichen lang sein."),
  kind: z.enum(PartnerKind.options, {
    errorMap: () => ({ message: "Bitte wählen Sie die Art des Ortes." }),
  }),
  street: z
    .string()
    .trim()
    .max(200, "Die Straße darf höchstens 200 Zeichen lang sein.")
    .transform((value) => (value === "" ? null : value)),
  postal_code: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || /^\d{5}$/.test(value), {
      message: "Bitte geben Sie eine fünfstellige Postleitzahl an.",
    }),
  district: z.enum(BERLIN_DISTRICTS, {
    errorMap: () => ({ message: "Bitte wählen Sie einen Bezirk." }),
  }),
  lat: optionalCoordinate(-90, 90),
  lng: optionalCoordinate(-180, 180),
  contact: z
    .string()
    .trim()
    .max(200, "Der Kontakt darf höchstens 200 Zeichen lang sein.")
    .transform((value) => (value === "" ? null : value)),
  is_verified: z.boolean(),
});

const IdSchema = z.string().uuid("Der Partner-Ort konnte nicht zugeordnet werden.");

function parseInput(formData: FormData) {
  return PartnerLocationInputSchema.safeParse({
    name: formString(formData, "name"),
    kind: formString(formData, "kind"),
    street: formString(formData, "street"),
    postal_code: formString(formData, "postal_code"),
    district: formString(formData, "district"),
    lat: formString(formData, "lat"),
    lng: formString(formData, "lng"),
    contact: formString(formData, "contact"),
    is_verified: formData.get("is_verified") === "on",
  });
}

export async function createPartnerLocationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseInput(formData);
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("partner_locations")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) {
    return { error: "Der Partner-Ort konnte nicht angelegt werden. Bitte versuchen Sie es erneut." };
  }

  audit({
    admin_email: admin.email,
    action: "partner_location_created",
    target: `partner_locations/${(data as { id: string }).id}`,
  });

  revalidatePath("/partner-orte");
  redirect("/partner-orte");
}

export async function updatePartnerLocationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsedId = IdSchema.safeParse(formString(formData, "id"));
  if (!parsedId.success) {
    return { error: firstZodError(parsedId.error) };
  }
  const parsed = parseInput(formData);
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("partner_locations")
    .update(parsed.data)
    .eq("id", parsedId.data);
  if (error) {
    return { error: "Der Partner-Ort konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." };
  }

  audit({
    admin_email: admin.email,
    action: "partner_location_updated",
    target: `partner_locations/${parsedId.data}`,
  });

  revalidatePath("/partner-orte");
  redirect("/partner-orte");
}

export async function deletePartnerLocationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsedId = IdSchema.safeParse(formString(formData, "id"));
  if (!parsedId.success) {
    return { error: firstZodError(parsedId.error) };
  }

  const db = createAdminClient();
  const { error } = await db.from("partner_locations").delete().eq("id", parsedId.data);
  if (error) {
    return { error: "Der Partner-Ort konnte nicht gelöscht werden. Bitte versuchen Sie es erneut." };
  }

  audit({
    admin_email: admin.email,
    action: "partner_location_deleted",
    target: `partner_locations/${parsedId.data}`,
  });

  revalidatePath("/partner-orte");
  redirect("/partner-orte");
}
