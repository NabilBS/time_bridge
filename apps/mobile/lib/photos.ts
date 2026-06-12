import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as ImageManipulator from "expo-image-manipulator";
import type { VerificationStatus } from "@zeitbruecke/shared";

import { isDemo, supabase } from "@/lib/supabase";

export const PHOTO_OFFLINE_MESSAGE =
  "Keine Verbindung – Ihre Eingaben sind gespeichert, bitte versuchen Sie es gleich erneut.";
export const PHOTO_OPEN_MESSAGE =
  "Sie haben bereits ein Foto eingereicht – es wird gerade geprüft.";

export interface PhotoState {
  /** Live-Foto im Profil (avatars-Pfad bzw. lokale Demo-URI). */
  photoPath: string | null;
  /** Jüngste Einreichung, falls vorhanden. */
  submissionStatus: VerificationStatus | null;
  reviewNote: string | null;
  /** Eigene Pending-Vorschau (lokale URI im Demo, sonst null – Pending liegt im privaten Bucket). */
  pendingUri: string | null;
}

const DEMO_KEY = "zeitbruecke.photo.demo.v1";

interface DemoPhotoState {
  photoPath: string | null;
  submissionStatus: VerificationStatus | null;
  reviewNote: string | null;
  pendingUri: string | null;
}

async function loadDemoPhoto(): Promise<DemoPhotoState> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw) as DemoPhotoState;
  } catch {
    /* neu */
  }
  return { photoPath: null, submissionStatus: null, reviewNote: null, pendingUri: null };
}

async function saveDemoPhoto(state: DemoPhotoState): Promise<void> {
  await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(state)).catch(() => undefined);
}

export async function loadPhotoState(): Promise<PhotoState> {
  if (isDemo || !supabase) {
    return loadDemoPhoto();
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error(PHOTO_OFFLINE_MESSAGE);

  const [{ data: profile }, { data: submission }] = await Promise.all([
    supabase.from("profiles").select("photo_path").eq("id", userId).maybeSingle(),
    supabase
      .from("photo_submissions")
      .select("status, review_note")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    photoPath: (profile?.photo_path as string | null) ?? null,
    submissionStatus: (submission?.status as VerificationStatus | undefined) ?? null,
    reviewNote: (submission?.review_note as string | null | undefined) ?? null,
    pendingUri: null,
  };
}

/**
 * Quadratisch zugeschnittenes Bild verkleinern und NEU KODIEREN.
 * Die Neukodierung über expo-image-manipulator entfernt alle EXIF-Metadaten
 * inklusive GPS-Position – das ist Pflicht, nicht Nebeneffekt.
 */
async function prepareImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

export async function submitPhoto(uri: string): Promise<void> {
  const cleanUri = await prepareImage(uri);

  if (isDemo || !supabase) {
    const state = await loadDemoPhoto();
    if (state.submissionStatus === "submitted") {
      throw new Error(PHOTO_OPEN_MESSAGE);
    }
    await saveDemoPhoto({
      ...state,
      submissionStatus: "submitted",
      reviewNote: null,
      pendingUri: cleanUri,
    });
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error(PHOTO_OFFLINE_MESSAGE);

  // Offene Einreichung früh abfangen (die DB erzwingt es zusätzlich).
  const { data: open, error: openError } = await supabase
    .from("photo_submissions")
    .select("id")
    .eq("profile_id", userId)
    .eq("status", "submitted")
    .maybeSingle();
  if (openError) throw new Error(PHOTO_OFFLINE_MESSAGE);
  if (open) throw new Error(PHOTO_OPEN_MESSAGE);

  const storagePath = `${userId}/${Crypto.randomUUID()}.jpg`;
  try {
    const fileData = await fetch(cleanUri).then((response) => response.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("avatars-pending")
      .upload(storagePath, fileData, { contentType: "image/jpeg" });
    if (uploadError) throw uploadError;
  } catch {
    throw new Error(PHOTO_OFFLINE_MESSAGE);
  }

  const { error: insertError } = await supabase.from("photo_submissions").insert({
    profile_id: userId,
    storage_path: storagePath,
  });
  if (insertError) {
    if ((insertError as { code?: string }).code === "23505") {
      throw new Error(PHOTO_OPEN_MESSAGE);
    }
    throw new Error(PHOTO_OFFLINE_MESSAGE);
  }
}

/** Nur Demo: simuliert die Freigabe durch das Team (Foto wird „live"). */
export async function simulateDemoPhotoApproval(): Promise<void> {
  const state = await loadDemoPhoto();
  if (state.submissionStatus !== "submitted" || !state.pendingUri) return;
  await saveDemoPhoto({
    photoPath: state.pendingUri,
    submissionStatus: "approved",
    reviewNote: null,
    pendingUri: null,
  });
}
