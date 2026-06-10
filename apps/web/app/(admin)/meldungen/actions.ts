"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/types";
import { firstZodError, formString } from "@/lib/validation";

const BlockSchema = z.object({
  report_id: z.string().uuid("Die Meldung konnte nicht zugeordnet werden."),
  profile_id: z.string().uuid("Das Profil konnte nicht zugeordnet werden."),
  reason: z
    .string()
    .trim()
    .min(1, "Bitte geben Sie eine Begründung für die Sperrung an.")
    .max(600, "Die Begründung darf höchstens 600 Zeichen lang sein."),
});

const UnblockSchema = z.object({
  report_id: z.string().uuid("Die Meldung konnte nicht zugeordnet werden."),
  profile_id: z.string().uuid("Das Profil konnte nicht zugeordnet werden."),
});

const ResolveSchema = z.object({
  report_id: z.string().uuid("Die Meldung konnte nicht zugeordnet werden."),
});

async function setProfileActive(profileId: string, isActive: boolean): Promise<string | null> {
  const db = createAdminClient();
  const { error } = await db.from("profiles").update({ is_active: isActive }).eq("id", profileId);
  if (error) {
    return "Die Änderung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.";
  }
  return null;
}

export async function blockProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = BlockSchema.safeParse({
    report_id: formString(formData, "report_id"),
    profile_id: formString(formData, "profile_id"),
    reason: formString(formData, "reason"),
  });
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }

  const updateError = await setProfileActive(parsed.data.profile_id, false);
  if (updateError) {
    return { error: updateError };
  }

  // Begründung landet vorerst nur im Audit-Log.
  audit({
    admin_email: admin.email,
    action: "profile_blocked",
    target: `profiles/${parsed.data.profile_id}`,
    reason: parsed.data.reason,
  });

  revalidatePath("/meldungen");
  revalidatePath(`/meldungen/${parsed.data.report_id}`);
  redirect(`/meldungen/${parsed.data.report_id}`);
}

export async function unblockProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = UnblockSchema.safeParse({
    report_id: formString(formData, "report_id"),
    profile_id: formString(formData, "profile_id"),
  });
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }

  const updateError = await setProfileActive(parsed.data.profile_id, true);
  if (updateError) {
    return { error: updateError };
  }

  audit({
    admin_email: admin.email,
    action: "profile_unblocked",
    target: `profiles/${parsed.data.profile_id}`,
  });

  revalidatePath("/meldungen");
  revalidatePath(`/meldungen/${parsed.data.report_id}`);
  redirect(`/meldungen/${parsed.data.report_id}`);
}

export async function resolveReportAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = ResolveSchema.safeParse({
    report_id: formString(formData, "report_id"),
  });
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("reports")
    .update({ is_resolved: true })
    .eq("id", parsed.data.report_id);
  if (error) {
    return { error: "Die Meldung konnte nicht als erledigt markiert werden. Bitte versuchen Sie es erneut." };
  }

  audit({
    admin_email: admin.email,
    action: "report_resolved",
    target: `reports/${parsed.data.report_id}`,
  });

  revalidatePath("/meldungen");
  redirect("/meldungen");
}
