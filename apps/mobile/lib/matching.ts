import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  CreateMatchRequestSchema,
  RPC_ACCEPT_REQUEST,
  type MatchRequestStatus,
  type ReportReasonId,
  type Role,
  type SearchFilter,
} from "@zeitbruecke/shared";

import { isDemo, supabase } from "@/lib/supabase";

export const PAGE_SIZE = 20;

export const OFFLINE_MESSAGE =
  "Keine Verbindung – Ihre Eingaben sind gespeichert, bitte versuchen Sie es gleich erneut.";
export const DUPLICATE_REQUEST_MESSAGE =
  "Sie haben dieser Person bereits eine Anfrage geschickt – sie wurde noch nicht beantwortet.";
export const INACTIVE_PROFILE_MESSAGE = "Dieses Profil ist nicht mehr aktiv.";

export interface DiscoverProfile {
  id: string;
  role: Role;
  display_name: string;
  district: string;
  trust_level: number;
  interests: string[];
  bio: string | null;
  birth_year: number;
  photo_path: string | null;
}

export interface RequestItem {
  id: string;
  direction: "received" | "sent";
  otherName: string;
  otherId: string;
  otherPhotoPath: string | null;
  message: string | null;
  status: MatchRequestStatus;
  created_at: string;
}

export interface MatchItem {
  id: string;
  partnerId: string | null;
  partnerName: string;
  partnerPhotoPath: string | null;
  partnerActive: boolean;
  lastMessage: string | null;
}

export interface ChatMessage {
  id: string;
  match_id: string;
  sender_profile: string;
  body: string;
  created_at: string;
}

async function ownId(): Promise<string> {
  if (!supabase) throw new Error(OFFLINE_MESSAGE);
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Sie sind nicht angemeldet.");
  return id;
}

/* ------------------------------------------------------------------ */
/* Demo-Modus: kompletter Loop lokal (Anfrage → Annahme nach 2 s →     */
/* Demo-Chat antwortet mit einer festen Nachricht).                    */
/* ------------------------------------------------------------------ */

export const DEMO_SELF_ID = "00000000-0000-4000-8000-000000000000";

const DEMO_GREETING =
  "Wie schön, dass wir zusammengefunden haben! Erzählen Sie mir gern, wie ich helfen kann.";
const DEMO_REPLY =
  "Vielen Dank für Ihre Nachricht! Das klingt gut – lassen Sie uns gern ein erstes Treffen an einem Partner-Ort verabreden.";

export const DEMO_PROFILES: DiscoverProfile[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    role: "senior",
    display_name: "Helga R.",
    district: "Pankow",
    trust_level: 3,
    interests: ["Vorlesen", "Backen", "Gesellschaftsspiele"],
    bio: "Ehemalige Bibliothekarin, liebt Geschichten und Apfelkuchen.",
    birth_year: 1954,
    photo_path: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    role: "senior",
    display_name: "Jürgen K.",
    district: "Neukölln",
    trust_level: 2,
    interests: ["Werken", "Natur", "Sport"],
    bio: "Tischler im Ruhestand – baut gern Vogelhäuser mit Kindern.",
    birth_year: 1949,
    photo_path: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    role: "senior",
    display_name: "Marianne S.",
    district: "Mitte",
    trust_level: 2,
    interests: ["Hausaufgaben", "Sprachen", "Musik"],
    bio: "War Lehrerin und hilft gern bei Mathe und Französisch.",
    birth_year: 1958,
    photo_path: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000201",
    role: "family",
    display_name: "Familie Aydin",
    district: "Neukölln",
    trust_level: 2,
    interests: ["Vorlesen", "Spielplatz"],
    bio: "Zwei Kinder (3 und 6), wir suchen eine Leih-Oma im Kiez.",
    birth_year: 1988,
    photo_path: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    role: "family",
    display_name: "Familie Brandt",
    district: "Pankow",
    trust_level: 1,
    interests: ["Hausaufgaben", "Musik"],
    bio: "Unsere Tochter (9) freut sich über Unterstützung bei den Hausaufgaben.",
    birth_year: 1985,
    photo_path: null,
  },
];

interface DemoState {
  requests: {
    id: string;
    from_profile: string;
    to_profile: string;
    message: string | null;
    status: MatchRequestStatus;
    created_at: string;
    acceptAt: number | null;
  }[];
  matches: { id: string; partnerId: string; created_at: string; replied: boolean }[];
  messages: ChatMessage[];
}

const DEMO_KEY = "zeitbruecke.matching.demo.v1";

function seededDemoState(): DemoState {
  // Eine eingehende Anfrage, damit auch „Annehmen" vorführbar ist.
  return {
    requests: [
      {
        id: Crypto.randomUUID(),
        from_profile: DEMO_PROFILES[0].id,
        to_profile: DEMO_SELF_ID,
        message: "Ich würde mich freuen, Ihnen donnerstags vorzulesen!",
        status: "pending",
        created_at: new Date().toISOString(),
        acceptAt: null,
      },
    ],
    matches: [],
    messages: [],
  };
}

async function loadDemoState(): Promise<DemoState> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    /* neu aufsetzen */
  }
  const state = seededDemoState();
  await saveDemoState(state);
  return state;
}

async function saveDemoState(state: DemoState): Promise<void> {
  await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(state)).catch(() => undefined);
}

function demoPartnerName(partnerId: string): string {
  return DEMO_PROFILES.find((profile) => profile.id === partnerId)?.display_name ?? "Demo-Profil";
}

/** Fällige simulierte Annahmen ausführen (Anfrage → Match → Begrüßung). */
async function materializeDemo(state: DemoState): Promise<DemoState> {
  const now = Date.now();
  let changed = false;
  for (const request of state.requests) {
    if (request.status === "pending" && request.acceptAt != null && request.acceptAt <= now) {
      request.status = "accepted";
      const matchId = Crypto.randomUUID();
      state.matches.push({
        id: matchId,
        partnerId: request.to_profile,
        created_at: new Date().toISOString(),
        replied: false,
      });
      state.messages.push({
        id: Crypto.randomUUID(),
        match_id: matchId,
        sender_profile: request.to_profile,
        body: DEMO_GREETING,
        created_at: new Date().toISOString(),
      });
      changed = true;
    }
  }
  if (changed) await saveDemoState(state);
  return state;
}

/* ------------------------------------------------------------------ */
/* Entdecken                                                           */
/* ------------------------------------------------------------------ */

export async function discoverProfiles(
  ownRole: Role,
  filter: SearchFilter,
  page: number,
): Promise<DiscoverProfile[]> {
  const targetRole: Role = ownRole === "senior" ? "family" : "senior";

  if (isDemo || !supabase) {
    return DEMO_PROFILES.filter((profile) => {
      if (profile.role !== targetRole) return false;
      if (filter.district && profile.district !== filter.district) return false;
      if (profile.trust_level < filter.min_trust_level) return false;
      if (
        filter.interests.length > 0 &&
        !profile.interests.some((interest) => filter.interests.includes(interest))
      ) {
        return false;
      }
      return true;
    });
  }

  const me = await ownId();
  let query = supabase
    .from("profiles")
    .select("id, role, display_name, district, trust_level, interests, bio, birth_year, photo_path")
    .eq("role", targetRole)
    .eq("is_active", true)
    .neq("id", me)
    .gte("trust_level", filter.min_trust_level);
  if (filter.district) query = query.eq("district", filter.district);
  if (filter.interests.length > 0) query = query.overlaps("interests", filter.interests);

  const { data, error } = await query
    .order("trust_level", { ascending: false })
    .order("created_at", { ascending: true })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) throw new Error(OFFLINE_MESSAGE);
  return (data ?? []) as DiscoverProfile[];
}

export async function loadProfileDetail(profileId: string): Promise<{
  profile: DiscoverProfile | null;
  availability: { weekday: number; time_from: string; time_to: string }[];
}> {
  if (isDemo || !supabase) {
    return {
      profile: DEMO_PROFILES.find((profile) => profile.id === profileId) ?? null,
      availability: [],
    };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, district, trust_level, interests, bio, birth_year, photo_path")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(OFFLINE_MESSAGE);
  if (!data) return { profile: null, availability: [] };

  let availability: { weekday: number; time_from: string; time_to: string }[] = [];
  if ((data as DiscoverProfile).role === "senior") {
    const { data: slots } = await supabase
      .from("availabilities")
      .select("weekday, time_from, time_to")
      .eq("profile_id", profileId)
      .order("weekday");
    availability = (slots ?? []).map((slot) => ({
      weekday: slot.weekday as number,
      time_from: String(slot.time_from).slice(0, 5),
      time_to: String(slot.time_to).slice(0, 5),
    }));
  }
  return { profile: data as DiscoverProfile, availability };
}

/* ------------------------------------------------------------------ */
/* Anfragen                                                            */
/* ------------------------------------------------------------------ */

export async function sendMatchRequest(toProfile: string, message: string): Promise<void> {
  const parsed = CreateMatchRequestSchema.parse({
    to_profile: toProfile,
    message: message.trim() ? message.trim() : null,
  });

  if (isDemo || !supabase) {
    const state = await loadDemoState();
    const open = state.requests.find(
      (request) => request.to_profile === toProfile && request.status === "pending",
    );
    if (open) throw new Error(DUPLICATE_REQUEST_MESSAGE);
    state.requests.push({
      id: Crypto.randomUUID(),
      from_profile: DEMO_SELF_ID,
      to_profile: parsed.to_profile,
      message: parsed.message,
      status: "pending",
      created_at: new Date().toISOString(),
      acceptAt: Date.now() + 2000, // simulierte Annahme nach 2 s
    });
    await saveDemoState(state);
    return;
  }

  const me = await ownId();
  const { error } = await supabase.from("match_requests").insert({
    from_profile: me,
    to_profile: parsed.to_profile,
    message: parsed.message,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error(DUPLICATE_REQUEST_MESSAGE);
    }
    if ((error as { code?: string }).code === "42501") {
      throw new Error(INACTIVE_PROFILE_MESSAGE);
    }
    throw new Error(OFFLINE_MESSAGE);
  }
}

export async function loadRequests(): Promise<RequestItem[]> {
  if (isDemo || !supabase) {
    const state = await materializeDemo(await loadDemoState());
    return state.requests
      .map((request): RequestItem => {
        const received = request.to_profile === DEMO_SELF_ID;
        const otherId = received ? request.from_profile : request.to_profile;
        return {
          otherPhotoPath: null,
          id: request.id,
          direction: received ? "received" : "sent",
          otherId,
          otherName: demoPartnerName(otherId),
          message: request.message,
          status: request.status,
          created_at: request.created_at,
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  const me = await ownId();
  const { data, error } = await supabase
    .from("match_requests")
    .select(
      `id, from_profile, to_profile, message, status, created_at,
       sender:profiles!match_requests_from_profile_fkey (id, display_name, photo_path),
       recipient:profiles!match_requests_to_profile_fkey (id, display_name, photo_path)`,
    )
    .or(`from_profile.eq.${me},to_profile.eq.${me}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(OFFLINE_MESSAGE);

  return (data ?? []).map((row): RequestItem => {
    const record = row as unknown as {
      id: string;
      from_profile: string;
      to_profile: string;
      message: string | null;
      status: MatchRequestStatus;
      created_at: string;
      sender: { id: string; display_name: string; photo_path: string | null } | null;
      recipient: { id: string; display_name: string; photo_path: string | null } | null;
    };
    const received = record.to_profile === me;
    const other = received ? record.sender : record.recipient;
    return {
      id: record.id,
      direction: received ? "received" : "sent",
      otherId: received ? record.from_profile : record.to_profile,
      otherName: other?.display_name ?? "Profil nicht mehr aktiv",
      otherPhotoPath: other?.photo_path ?? null,
      message: record.message,
      status: record.status,
      created_at: record.created_at,
    };
  });
}

/** Annahme läuft NUR über die RPC – nie per direktem Update. Gibt die Match-ID zurück. */
export async function acceptRequest(requestId: string): Promise<string> {
  if (isDemo || !supabase) {
    const state = await loadDemoState();
    const request = state.requests.find((entry) => entry.id === requestId);
    if (!request || request.status !== "pending") {
      throw new Error("Diese Anfrage ist nicht mehr offen.");
    }
    request.status = "accepted";
    const matchId = Crypto.randomUUID();
    state.matches.push({
      id: matchId,
      partnerId: request.from_profile,
      created_at: new Date().toISOString(),
      replied: false,
    });
    state.messages.push({
      id: Crypto.randomUUID(),
      match_id: matchId,
      sender_profile: request.from_profile,
      body: DEMO_GREETING,
      created_at: new Date().toISOString(),
    });
    await saveDemoState(state);
    return matchId;
  }

  const { data, error } = await supabase.rpc(RPC_ACCEPT_REQUEST, { p_request: requestId });
  if (error) {
    throw new Error(error.message || OFFLINE_MESSAGE);
  }
  return data as string;
}

async function updateRequestStatus(
  requestId: string,
  status: "declined" | "withdrawn",
): Promise<void> {
  if (isDemo || !supabase) {
    const state = await loadDemoState();
    const request = state.requests.find((entry) => entry.id === requestId);
    if (request && request.status === "pending") {
      request.status = status;
      request.acceptAt = null;
      await saveDemoState(state);
    }
    return;
  }
  const { error } = await supabase
    .from("match_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw new Error(OFFLINE_MESSAGE);
}

export const declineRequest = (requestId: string) => updateRequestStatus(requestId, "declined");
export const withdrawRequest = (requestId: string) => updateRequestStatus(requestId, "withdrawn");

/** Offene/angenommene Anfrage an ein Profil (für den CTA im Profildetail). */
export async function existingRequestTo(profileId: string): Promise<MatchRequestStatus | null> {
  if (isDemo || !supabase) {
    const state = await materializeDemo(await loadDemoState());
    const request = state.requests
      .filter((entry) => entry.to_profile === profileId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return request && (request.status === "pending" || request.status === "accepted")
      ? request.status
      : null;
  }
  const me = await ownId();
  const { data, error } = await supabase
    .from("match_requests")
    .select("status")
    .eq("from_profile", me)
    .eq("to_profile", profileId)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(OFFLINE_MESSAGE);
  return (data?.status as MatchRequestStatus | undefined) ?? null;
}

/* ------------------------------------------------------------------ */
/* Matches & Chat                                                      */
/* ------------------------------------------------------------------ */

export async function loadMatches(): Promise<MatchItem[]> {
  if (isDemo || !supabase) {
    const state = await materializeDemo(await loadDemoState());
    return state.matches
      .map((match): MatchItem => {
        const last = state.messages
          .filter((message) => message.match_id === match.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return {
          id: match.id,
          partnerId: match.partnerId,
          partnerName: demoPartnerName(match.partnerId),
          partnerPhotoPath: null,
          partnerActive: true,
          lastMessage: last?.body ?? null,
        };
      })
      .reverse();
  }

  const me = await ownId();
  const { data, error } = await supabase
    .from("matches")
    .select(
      `id, profile_a, profile_b, created_at,
       a:profiles!matches_profile_a_fkey (id, display_name, is_active, photo_path),
       b:profiles!matches_profile_b_fkey (id, display_name, is_active, photo_path)`,
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(OFFLINE_MESSAGE);

  const items: MatchItem[] = [];
  for (const row of data ?? []) {
    const record = row as unknown as {
      id: string;
      profile_a: string;
      profile_b: string;
      a: { id: string; display_name: string; is_active: boolean; photo_path: string | null } | null;
      b: { id: string; display_name: string; is_active: boolean; photo_path: string | null } | null;
    };
    // Gesperrte Profile sind per RLS unsichtbar – der Join liefert dann null.
    const partner = record.profile_a === me ? record.b : record.a;
    const { data: last } = await supabase
      .from("messages")
      .select("body")
      .eq("match_id", record.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    items.push({
      id: record.id,
      partnerId: partner?.id ?? null,
      partnerName: partner?.display_name ?? "Profil nicht mehr aktiv",
      partnerPhotoPath: partner?.photo_path ?? null,
      partnerActive: partner?.is_active ?? false,
      lastMessage: (last?.body as string | undefined) ?? null,
    });
  }
  return items;
}

export async function loadMatchHeader(
  matchId: string,
): Promise<{ partnerId: string | null; partnerName: string; partnerActive: boolean; selfId: string }> {
  if (isDemo || !supabase) {
    const state = await loadDemoState();
    const match = state.matches.find((entry) => entry.id === matchId);
    return {
      partnerId: match?.partnerId ?? null,
      partnerName: match ? demoPartnerName(match.partnerId) : "Demo-Profil",
      partnerActive: !!match,
      selfId: DEMO_SELF_ID,
    };
  }
  const me = await ownId();
  const { data, error } = await supabase
    .from("matches")
    .select(
      `id, profile_a, profile_b,
       a:profiles!matches_profile_a_fkey (id, display_name, is_active, photo_path),
       b:profiles!matches_profile_b_fkey (id, display_name, is_active, photo_path)`,
    )
    .eq("id", matchId)
    .maybeSingle();
  if (error || !data) throw new Error(OFFLINE_MESSAGE);
  const record = data as unknown as {
    profile_a: string;
    a: { id: string; display_name: string; is_active: boolean } | null;
    b: { id: string; display_name: string; is_active: boolean } | null;
  };
  const partner = record.profile_a === me ? record.b : record.a;
  return {
    partnerId: partner?.id ?? null,
    partnerName: partner?.display_name ?? "Profil nicht mehr aktiv",
    partnerActive: partner?.is_active ?? false,
    selfId: me,
  };
}

export async function loadMessages(matchId: string): Promise<ChatMessage[]> {
  if (isDemo || !supabase) {
    const state = await materializeDemo(await loadDemoState());
    return state.messages
      .filter((message) => message.match_id === matchId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  const { data, error } = await supabase
    .from("messages")
    .select("id, match_id, sender_profile, body, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(OFFLINE_MESSAGE);
  return (data ?? []) as ChatMessage[];
}

export async function sendChatMessage(matchId: string, body: string): Promise<ChatMessage> {
  if (isDemo || !supabase) {
    const state = await loadDemoState();
    const message: ChatMessage = {
      id: Crypto.randomUUID(),
      match_id: matchId,
      sender_profile: DEMO_SELF_ID,
      body,
      created_at: new Date().toISOString(),
    };
    state.messages.push(message);
    const match = state.matches.find((entry) => entry.id === matchId);
    if (match && !match.replied) {
      match.replied = true;
      state.messages.push({
        id: Crypto.randomUUID(),
        match_id: matchId,
        sender_profile: match.partnerId,
        body: DEMO_REPLY,
        created_at: new Date(Date.now() + 1000).toISOString(),
      });
    }
    await saveDemoState(state);
    return message;
  }

  const me = await ownId();
  const { data, error } = await supabase
    .from("messages")
    .insert({ match_id: matchId, sender_profile: me, body })
    .select("id, match_id, sender_profile, body, created_at")
    .single();
  if (error) throw new Error(OFFLINE_MESSAGE);
  return data as ChatMessage;
}

/** Realtime-Subscription auf neue Nachrichten eines Matches (RLS-gefiltert). */
export function subscribeToMessages(
  matchId: string,
  onMessage: (message: ChatMessage) => void,
): () => void {
  if (isDemo || !supabase) {
    return () => undefined;
  }
  const channel = supabase
    .channel(`messages:${matchId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
      (payload) => onMessage(payload.new as ChatMessage),
    )
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}

/* ------------------------------------------------------------------ */
/* Melden                                                              */
/* ------------------------------------------------------------------ */

export async function reportProfile(
  reportedProfile: string,
  reason: ReportReasonId,
  details: string,
): Promise<void> {
  if (isDemo || !supabase) {
    return; // Demo: nichts speichern, UI bestätigt trotzdem
  }
  const me = await ownId();
  const { error } = await supabase.from("reports").insert({
    reporter_profile: me,
    reported_profile: reportedProfile,
    reason,
    details: details.trim() ? details.trim() : null,
  });
  if (error) throw new Error(OFFLINE_MESSAGE);
}
