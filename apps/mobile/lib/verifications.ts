import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  verificationDocPath,
  type VerificationStatus,
  type VerificationType,
} from "@zeitbruecke/shared";

import { isDemo, supabase } from "@/lib/supabase";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/pdf",
] as const;

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export interface VerificationEntry {
  id: string;
  type: VerificationType;
  status: VerificationStatus;
  valid_until: string | null;
  created_at: string;
}

export interface PickedFile {
  uri: string;
  mimeType: string;
  size: number | null;
  name: string;
}

export class VerificationError extends Error {
  constructor(
    public code: "offline" | "duplicate" | "file_too_large" | "file_type" | "not_signed_in",
    message: string,
  ) {
    super(message);
  }
}

export const VERIFICATION_ERROR_MESSAGES = {
  offline: "Keine Verbindung – Ihre Eingaben sind gespeichert, bitte versuchen Sie es gleich erneut.",
  duplicate: "Sie haben diesen Nachweis bereits eingereicht – er wird gerade geprüft.",
  file_too_large: "Die Datei ist zu groß (höchstens 10 MB).",
  file_type: "Dieses Dateiformat wird nicht unterstützt. Erlaubt sind JPG, PNG, HEIC oder PDF.",
  not_signed_in: "Sie sind nicht angemeldet. Bitte melden Sie sich erneut an.",
} as const;

export function validatePickedFile(file: PickedFile): void {
  if (!MIME_EXTENSIONS[file.mimeType]) {
    throw new VerificationError("file_type", VERIFICATION_ERROR_MESSAGES.file_type);
  }
  if (file.size != null && file.size > MAX_DOCUMENT_BYTES) {
    throw new VerificationError("file_too_large", VERIFICATION_ERROR_MESSAGES.file_too_large);
  }
}

/** Spiegelbild der Trigger-Logik aus 0001_init.sql – nur für den Demo-Modus. */
export function computeTrustLevel(entries: VerificationEntry[]): number {
  const approved = (type: VerificationType) =>
    entries.some((entry) => entry.type === type && entry.status === "approved");
  if (approved("video_ident") && approved("background_check")) return 3;
  if (approved("video_ident")) return 2;
  return 1;
}

const DEMO_KEY = "zeitbruecke.verifications.demo.v1";

async function loadDemoEntries(): Promise<VerificationEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as VerificationEntry[]) : [];
  } catch {
    return [];
  }
}

async function saveDemoEntries(entries: VerificationEntry[]): Promise<void> {
  await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(entries)).catch(() => undefined);
}

export async function loadVerifications(): Promise<VerificationEntry[]> {
  if (isDemo || !supabase) {
    return loadDemoEntries();
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    throw new VerificationError("not_signed_in", VERIFICATION_ERROR_MESSAGES.not_signed_in);
  }
  const { data, error } = await supabase
    .from("verifications")
    .select("id, type, status, valid_until, created_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new VerificationError("offline", VERIFICATION_ERROR_MESSAGES.offline);
  }
  return (data ?? []) as VerificationEntry[];
}

/** Jüngste Einreichung je Typ – ältere (z. B. abgelehnte) Zeilen zählen nicht mehr. */
export function latestByType(
  entries: VerificationEntry[],
): Partial<Record<VerificationType, VerificationEntry>> {
  const result: Partial<Record<VerificationType, VerificationEntry>> = {};
  for (const entry of entries) {
    const existing = result[entry.type];
    if (!existing || entry.created_at > existing.created_at) {
      result[entry.type] = entry;
    }
  }
  return result;
}

export async function submitVerification(
  type: VerificationType,
  file: PickedFile | null,
): Promise<void> {
  if (isDemo || !supabase) {
    const entries = await loadDemoEntries();
    const open = latestByType(entries)[type];
    if (open && (open.status === "submitted" || open.status === "approved")) {
      throw new VerificationError("duplicate", VERIFICATION_ERROR_MESSAGES.duplicate);
    }
    if (file) validatePickedFile(file);
    entries.push({
      id: Crypto.randomUUID(),
      type,
      status: "submitted",
      valid_until: null,
      created_at: new Date().toISOString(),
    });
    await saveDemoEntries(entries);
    return;
  }

  if (!file) {
    throw new VerificationError("file_type", VERIFICATION_ERROR_MESSAGES.file_type);
  }
  validatePickedFile(file);

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    throw new VerificationError("not_signed_in", VERIFICATION_ERROR_MESSAGES.not_signed_in);
  }

  // Doppel-Einreichung früh abfangen (die DB erzwingt es zusätzlich per Unique-Index).
  const { data: existing, error: existingError } = await supabase
    .from("verifications")
    .select("id")
    .eq("profile_id", userId)
    .eq("type", type)
    .eq("status", "submitted")
    .maybeSingle();
  if (existingError) {
    throw new VerificationError("offline", VERIFICATION_ERROR_MESSAGES.offline);
  }
  if (existing) {
    throw new VerificationError("duplicate", VERIFICATION_ERROR_MESSAGES.duplicate);
  }

  const verificationId = Crypto.randomUUID();
  const ext = MIME_EXTENSIONS[file.mimeType];
  const path = verificationDocPath(userId, verificationId, ext);

  try {
    const fileData = await fetch(file.uri).then((response) => response.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("verification-docs")
      .upload(path, fileData, { contentType: file.mimeType });
    if (uploadError) throw uploadError;
  } catch (caught) {
    if (caught instanceof VerificationError) throw caught;
    throw new VerificationError("offline", VERIFICATION_ERROR_MESSAGES.offline);
  }

  const { error: insertError } = await supabase.from("verifications").insert({
    id: verificationId,
    profile_id: userId,
    type,
    status: "submitted",
    document_path: path,
  });
  if (insertError) {
    // 23505 = Unique-Index: parallel eingereicht; verwaiste Datei räumt die Service-Role ab.
    if ((insertError as { code?: string }).code === "23505") {
      throw new VerificationError("duplicate", VERIFICATION_ERROR_MESSAGES.duplicate);
    }
    throw new VerificationError("offline", VERIFICATION_ERROR_MESSAGES.offline);
  }
}

/** Nur Demo: setzt die jüngste submitted-Einreichung auf approved (Badge-Sprung vorführbar). */
export async function simulateDemoApproval(type: VerificationType): Promise<void> {
  const entries = await loadDemoEntries();
  const entry = latestByType(entries)[type];
  if (!entry || entry.status !== "submitted") return;
  entry.status = "approved";
  if (type === "background_check") {
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 3);
    entry.valid_until = validUntil.toISOString().slice(0, 10);
  }
  await saveDemoEntries(entries);
}
