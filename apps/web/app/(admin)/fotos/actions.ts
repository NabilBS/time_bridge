"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState, PhotoSubmissionRow } from "@/lib/types";
import { firstZodError, formString } from "@/lib/validation";
import { REJECT_REASONS, type RejectReasonKey } from "./reject-reasons";

const IdSchema = z.string().uuid("Die Einreichung konnte nicht zugeordnet werden.");

const RejectSchema = z.object({
  id: IdSchema,
  reason: z.enum(
    Object.keys(REJECT_REASONS) as [RejectReasonKey, ...RejectReasonKey[]],
    { errorMap: () => ({ message: "Bitte wählen Sie eine Begründung." }) },
  ),
  note: z
    .string()
    .trim()
    .max(500, "Die Anmerkung darf höchstens 500 Zeichen lang sein."),
});

async function loadSubmittedPhoto(
  id: string,
): Promise<{ submission: PhotoSubmissionRow } | { error: string }> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("photo_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return { error: "Die Einreichung konnte nicht geladen werden. Bitte versuchen Sie es erneut." };
  }
  if (!data) {
    return { error: "Die Einreichung wurde nicht gefunden." };
  }
  const submission = data as PhotoSubmissionRow;
  if (submission.status !== "submitted") {
    return { error: "Diese Einreichung wurde bereits bearbeitet." };
  }
  return { submission };
}

export async function approvePhotoAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsedId = IdSchema.safeParse(formString(formData, "id"));
  if (!parsedId.success) {
    return { error: firstZodError(parsedId.error) };
  }
  const loaded = await loadSubmittedPhoto(parsedId.data);
  if ("error" in loaded) {
    return { error: loaded.error };
  }
  const { submission } = loaded;

  const db = createAdminClient();
  const targetPath = `${submission.profile_id}/avatar.jpg`;
  const failure =
    "Die Freigabe konnte nicht abgeschlossen werden – es wurde nichts verändert. Bitte versuchen Sie es erneut.";

  // Atomare Reihenfolge: kopieren → photo_path setzen → Pending löschen →
  // Status setzen. Schlägt ein Schritt fehl, wird abgebrochen.
  // Ein evtl. vorhandenes altes Foto wird ersetzt (copy kennt kein upsert).
  await db.storage.from("avatars").remove([targetPath]);
  const { error: copyError } = await db.storage
    .from("avatars-pending")
    .copy(submission.storage_path, targetPath, { destinationBucket: "avatars" });
  if (copyError) {
    return { error: failure };
  }

  const { error: profileError } = await db
    .from("profiles")
    .update({ photo_path: targetPath })
    .eq("id", submission.profile_id);
  if (profileError) {
    return { error: failure };
  }

  const { error: removeError } = await db.storage
    .from("avatars-pending")
    .remove([submission.storage_path]);
  if (removeError) {
    return { error: failure };
  }

  const { error: statusError } = await db
    .from("photo_submissions")
    .update({ status: "approved" })
    .eq("id", submission.id);
  if (statusError) {
    return { error: failure };
  }

  audit({
    admin_email: admin.email,
    action: "photo_approved",
    target: `photo_submissions/${submission.id}`,
  });

  revalidatePath("/fotos");
  redirect("/fotos");
}

export async function rejectPhotoAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = RejectSchema.safeParse({
    id: formString(formData, "id"),
    reason: formString(formData, "reason"),
    note: formString(formData, "note"),
  });
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }
  const loaded = await loadSubmittedPhoto(parsed.data.id);
  if ("error" in loaded) {
    return { error: loaded.error };
  }
  const { submission } = loaded;

  const db = createAdminClient();

  // Pending-Datei ZUERST löschen – ein abgelehntes Foto bleibt nirgends liegen.
  const { error: removeError } = await db.storage
    .from("avatars-pending")
    .remove([submission.storage_path]);
  if (removeError) {
    return {
      error:
        "Das Foto konnte nicht gelöscht werden. Die Aktion wurde abgebrochen – bitte versuchen Sie es erneut.",
    };
  }

  const reviewNote = parsed.data.note
    ? `${REJECT_REASONS[parsed.data.reason]} – ${parsed.data.note}`
    : REJECT_REASONS[parsed.data.reason];

  const { error: statusError } = await db
    .from("photo_submissions")
    .update({ status: "rejected", review_note: reviewNote })
    .eq("id", submission.id);
  if (statusError) {
    return { error: "Die Ablehnung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." };
  }

  audit({
    admin_email: admin.email,
    action: "photo_rejected",
    target: `photo_submissions/${submission.id}`,
  });

  revalidatePath("/fotos");
  redirect("/fotos");
}
