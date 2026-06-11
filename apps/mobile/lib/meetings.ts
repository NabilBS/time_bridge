import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  CreateReviewSchema,
  RPC_REVIEW_STATS,
  type MeetingStatus,
  type PartnerKind,
} from "@zeitbruecke/shared";

import { DEMO_SELF_ID } from "@/lib/matching";
import { isDemo, supabase } from "@/lib/supabase";

export const OFFLINE_MESSAGE =
  "Keine Verbindung – Ihre Eingaben sind gespeichert, bitte versuchen Sie es gleich erneut.";
export const FIRST_MEETING_MESSAGE =
  "Das erste Treffen findet an einem Partner-Ort statt.";
export const ALREADY_REVIEWED_MESSAGE =
  "Sie haben dieses Treffen bereits bewertet.";

export interface PartnerLocationItem {
  id: string;
  name: string;
  kind: PartnerKind;
  street: string | null;
  postal_code: string | null;
  district: string | null;
}

export interface MeetingItem {
  id: string;
  match_id: string;
  partner_location_id: string | null;
  locationName: string | null;
  scheduled_at: string;
  status: MeetingStatus;
}

export interface ReviewStats {
  count: number;
  avg: number | null;
}

async function ownId(): Promise<string> {
  if (isDemo || !supabase) return DEMO_SELF_ID;
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Sie sind nicht angemeldet.");
  return id;
}

/* ------------------------------------------------------------------ */
/* Demo-Zustand                                                        */
/* ------------------------------------------------------------------ */

const DEMO_KEY = "zeitbruecke.meetings.demo.v1";

const DEMO_LOCATIONS: PartnerLocationItem[] = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    name: "MGH Musterstraße [Platzhalter]",
    kind: "mehrgenerationenhaus",
    street: "Musterstraße 1",
    postal_code: "10115",
    district: "Mitte",
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    name: "Stadtteilzentrum Beispielplatz [Platzhalter]",
    kind: "stadtteilzentrum",
    street: "Beispielplatz 4",
    postal_code: "12043",
    district: "Neukölln",
  },
  {
    id: "00000000-0000-4000-8000-000000000303",
    name: "Familienzentrum Platzhalterweg [Platzhalter]",
    kind: "familienzentrum",
    street: "Platzhalterweg 7",
    postal_code: "13187",
    district: "Pankow",
  },
];

interface DemoMeeting {
  id: string;
  match_id: string;
  partner_location_id: string | null;
  locationName: string | null;
  scheduled_at: string;
  status: MeetingStatus;
}

interface DemoReview {
  meeting_id: string;
  reviewer_id: string;
  reviewed_id: string;
  stars: number;
  comment: string | null;
}

interface DemoState {
  meetings: DemoMeeting[];
  reviews: DemoReview[];
}

async function loadDemoState(): Promise<DemoState> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    /* neu */
  }
  return { meetings: [], reviews: [] };
}

async function saveDemoState(state: DemoState): Promise<void> {
  await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(state)).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Partner-Orte                                                        */
/* ------------------------------------------------------------------ */

export async function loadPartnerLocations(
  districts: string[],
): Promise<PartnerLocationItem[]> {
  if (isDemo || !supabase) {
    return DEMO_LOCATIONS;
  }
  let query = supabase
    .from("partner_locations")
    .select("id, name, kind, street, postal_code, district")
    .eq("is_verified", true)
    .order("name");
  const filtered = districts.filter(Boolean);
  if (filtered.length > 0) {
    query = query.in("district", filtered);
  }
  const { data, error } = await query;
  if (error) throw new Error(OFFLINE_MESSAGE);
  return (data ?? []) as PartnerLocationItem[];
}

/* ------------------------------------------------------------------ */
/* Treffen                                                             */
/* ------------------------------------------------------------------ */

export async function isFirstMeeting(matchId: string): Promise<boolean> {
  const meetings = await loadMeetings(matchId);
  return !meetings.some((m) => m.status === "planned" || m.status === "completed");
}

export async function loadMeetings(matchId: string): Promise<MeetingItem[]> {
  if (isDemo || !supabase) {
    const state = await loadDemoState();
    return state.meetings
      .filter((m) => m.match_id === matchId)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }
  const { data, error } = await supabase
    .from("meetings")
    .select(
      `id, match_id, partner_location_id, scheduled_at, status,
       location:partner_locations!meetings_partner_location_id_fkey (name)`,
    )
    .eq("match_id", matchId)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(OFFLINE_MESSAGE);
  return (data ?? []).map((row): MeetingItem => {
    const record = row as unknown as {
      id: string;
      match_id: string;
      partner_location_id: string | null;
      scheduled_at: string;
      status: MeetingStatus;
      location: { name: string } | null;
    };
    return {
      id: record.id,
      match_id: record.match_id,
      partner_location_id: record.partner_location_id,
      locationName: record.location?.name ?? null,
      scheduled_at: record.scheduled_at,
      status: record.status,
    };
  });
}

export async function createMeeting(
  matchId: string,
  partnerLocationId: string | null,
  scheduledAtIso: string,
  freeTextLocation?: string,
): Promise<void> {
  if (isDemo || !supabase) {
    const state = await loadDemoState();
    const first = !state.meetings.some(
      (m) => m.match_id === matchId && (m.status === "planned" || m.status === "completed"),
    );
    if (first && !partnerLocationId) {
      throw new Error(FIRST_MEETING_MESSAGE);
    }
    const locationName = partnerLocationId
      ? DEMO_LOCATIONS.find((l) => l.id === partnerLocationId)?.name ?? null
      : freeTextLocation?.trim() || null;
    state.meetings.push({
      id: Crypto.randomUUID(),
      match_id: matchId,
      partner_location_id: partnerLocationId,
      locationName,
      scheduled_at: scheduledAtIso,
      status: "planned",
    });
    await saveDemoState(state);
    return;
  }

  const { error } = await supabase.from("meetings").insert({
    match_id: matchId,
    partner_location_id: partnerLocationId,
    scheduled_at: scheduledAtIso,
  });
  if (error) {
    if (error.message?.includes("Partner-Ort")) throw new Error(FIRST_MEETING_MESSAGE);
    throw new Error(OFFLINE_MESSAGE);
  }
}

async function setMeetingStatus(meetingId: string, status: MeetingStatus): Promise<void> {
  if (isDemo || !supabase) {
    const state = await loadDemoState();
    const meeting = state.meetings.find((m) => m.id === meetingId);
    if (meeting) {
      meeting.status = status;
      await saveDemoState(state);
    }
    return;
  }
  const { error } = await supabase.from("meetings").update({ status }).eq("id", meetingId);
  if (error) throw new Error(OFFLINE_MESSAGE);
}

export const cancelMeeting = (meetingId: string) => setMeetingStatus(meetingId, "cancelled");
export const completeMeeting = (meetingId: string) => setMeetingStatus(meetingId, "completed");

/** Abgeschlossene Treffen des Nutzers über alle Matches (RLS begrenzt auf eigene). */
export async function countCompletedMeetings(): Promise<number> {
  if (isDemo || !supabase) {
    const state = await loadDemoState();
    return state.meetings.filter((m) => m.status === "completed").length;
  }
  const { count, error } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");
  if (error) return 0;
  return count ?? 0;
}

/* ------------------------------------------------------------------ */
/* Bewertungen                                                         */
/* ------------------------------------------------------------------ */

export async function hasReviewed(meetingId: string): Promise<boolean> {
  const me = await ownId();
  if (isDemo || !supabase) {
    const state = await loadDemoState();
    return state.reviews.some((r) => r.meeting_id === meetingId && r.reviewer_id === me);
  }
  const { data, error } = await supabase
    .from("reviews")
    .select("id")
    .eq("meeting_id", meetingId)
    .eq("reviewer_id", me)
    .maybeSingle();
  if (error) throw new Error(OFFLINE_MESSAGE);
  return !!data;
}

export async function submitReview(
  meetingId: string,
  stars: number,
  comment: string,
  reviewedId?: string,
): Promise<void> {
  const parsed = CreateReviewSchema.parse({
    meeting_id: meetingId,
    stars,
    comment: comment.trim() ? comment.trim() : null,
  });
  const me = await ownId();

  if (isDemo || !supabase) {
    const state = await loadDemoState();
    if (state.reviews.some((r) => r.meeting_id === meetingId && r.reviewer_id === me)) {
      throw new Error(ALREADY_REVIEWED_MESSAGE);
    }
    state.reviews.push({
      meeting_id: meetingId,
      reviewer_id: me,
      reviewed_id: reviewedId ?? "demo-partner",
      stars: parsed.stars,
      comment: parsed.comment,
    });
    await saveDemoState(state);
    return;
  }

  const { error } = await supabase.from("reviews").insert({
    meeting_id: parsed.meeting_id,
    reviewer_id: me,
    stars: parsed.stars,
    comment: parsed.comment,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error(ALREADY_REVIEWED_MESSAGE);
    }
    throw new Error(OFFLINE_MESSAGE);
  }
}

export async function loadReviewStats(profileId: string): Promise<ReviewStats> {
  if (isDemo || !supabase) {
    const state = await loadDemoState();
    const relevant = state.reviews.filter((r) => r.reviewed_id === profileId);
    if (relevant.length === 0) return { count: 0, avg: null };
    const avg = relevant.reduce((sum, r) => sum + r.stars, 0) / relevant.length;
    return { count: relevant.length, avg: Math.round(avg * 10) / 10 };
  }
  const { data, error } = await supabase.rpc(RPC_REVIEW_STATS, { p_profile: profileId });
  if (error) throw new Error(OFFLINE_MESSAGE);
  const row = Array.isArray(data) ? data[0] : data;
  const count = Number(row?.review_count ?? 0);
  const avg = row?.avg_stars != null ? Number(row.avg_stars) : null;
  return { count, avg: count > 0 ? avg : null };
}

/** Eigenes Demo-Aggregat: Bewertungen, die der Nutzer im Demo abgegeben hat,
 *  zählen für das Demo-Partner-Profil – damit der Aggregat-Sprung sichtbar wird. */
export async function loadDemoSelfStats(): Promise<ReviewStats> {
  const state = await loadDemoState();
  const me = DEMO_SELF_ID;
  const aboutMe = state.reviews.filter((r) => r.reviewer_id !== me);
  if (aboutMe.length === 0) return { count: 0, avg: null };
  const avg = aboutMe.reduce((sum, r) => sum + r.stars, 0) / aboutMe.length;
  return { count: aboutMe.length, avg: Math.round(avg * 10) / 10 };
}
