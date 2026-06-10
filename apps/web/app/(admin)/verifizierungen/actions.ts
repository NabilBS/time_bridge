"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { addYearsToIsoDate, todayIsoDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState, VerificationRow } from "@/lib/types";
import { firstZodError, formString } from "@/lib/validation";

const ApproveSchema = z.object({
  id: z.string().uuid("Die Einreichung konnte nicht zugeordnet werden."),
  issue_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte geben Sie das Ausstellungsdatum an.")
    .nullable(),
});

const RejectSchema = z.object({
  id: z.string().uuid("Die Einreichung konnte nicht zugeordnet werden."),
  review_note: z
    .string()
    .trim()
    .min(1, "Bitte geben Sie eine Begründung für die Ablehnung an.")
    .max(600, "Die Begründung darf höchstens 600 Zeichen lang sein."),
});

async function loadSubmittedVerification(
  id: string,
): Promise<{ verification: VerificationRow } | { error: string }> {
  const db = createAdminClient();
  const { data, error } = await db.from("verifications").select("*").eq("id", id).maybeSingle();
  if (error) {
    return { error: "Die Einreichung konnte nicht geladen werden. Bitte versuchen Sie es erneut." };
  }
  if (!data) {
    return { error: "Die Einreichung wurde nicht gefunden." };
  }
  const verification = data as VerificationRow;
  if (verification.status !== "submitted") {
    return { error: "Diese Einreichung wurde bereits bearbeitet." };
  }
  return { verification };
}

/** Löscht das Dokument im Bucket. Muss VOR dem Status-Update gelingen. */
async function deleteDocument(path: string): Promise<string | null> {
  const db = createAdminClient();
  const { error } = await db.storage.from("verification-docs").remove([path]);
  if (error) {
    return "Das Dokument konnte nicht gelöscht werden. Die Aktion wurde abgebrochen – bitte versuchen Sie es erneut.";
  }
  return null;
}

export async function approveVerificationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = ApproveSchema.safeParse({
    id: formString(formData, "id"),
    issue_date: formString(formData, "issue_date") || null,
  });
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }

  const loaded = await loadSubmittedVerification(parsed.data.id);
  if ("error" in loaded) {
    return { error: loaded.error };
  }
  const { verification } = loaded;

  const update: Record<string, unknown> = {
    status: "approved",
    reviewed_by: admin.id,
    reviewed_at: new Date().toISOString(),
  };

  if (verification.type === "background_check") {
    const issueDate = parsed.data.issue_date;
    if (!issueDate) {
      return { error: "Bitte geben Sie das Ausstellungsdatum des Führungszeugnisses an." };
    }
    if (issueDate > todayIsoDate()) {
      return { error: "Das Ausstellungsdatum darf nicht in der Zukunft liegen." };
    }
    update.valid_until = addYearsToIsoDate(issueDate, 3);

    // Löschregel (Datenminimierung): ZUERST die Datei löschen, dann das Update.
    if (verification.document_path) {
      const deleteError = await deleteDocument(verification.document_path);
      if (deleteError) {
        return { error: deleteError };
      }
    }
    update.document_path = null;
  }

  const db = createAdminClient();
  const { error: updateError } = await db
    .from("verifications")
    .update(update)
    .eq("id", verification.id);
  if (updateError) {
    return { error: "Die Freigabe konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." };
  }

  audit({
    admin_email: admin.email,
    action: "verification_approved",
    target: `verifications/${verification.id}`,
  });

  revalidatePath("/verifizierungen");
  redirect("/verifizierungen");
}

export async function rejectVerificationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = RejectSchema.safeParse({
    id: formString(formData, "id"),
    review_note: formString(formData, "review_note"),
  });
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }

  const loaded = await loadSubmittedVerification(parsed.data.id);
  if ("error" in loaded) {
    return { error: loaded.error };
  }
  const { verification } = loaded;

  // Auch bei Ablehnung wird das Dokument gelöscht – ZUERST löschen, dann Update.
  if (verification.document_path) {
    const deleteError = await deleteDocument(verification.document_path);
    if (deleteError) {
      return { error: deleteError };
    }
  }

  const db = createAdminClient();
  const { error: updateError } = await db
    .from("verifications")
    .update({
      status: "rejected",
      review_note: parsed.data.review_note,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      document_path: null,
    })
    .eq("id", verification.id);
  if (updateError) {
    return { error: "Die Ablehnung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." };
  }

  audit({
    admin_email: admin.email,
    action: "verification_rejected",
    target: `verifications/${verification.id}`,
    reason: parsed.data.review_note,
  });

  revalidatePath("/verifizierungen");
  redirect("/verifizierungen");
}
