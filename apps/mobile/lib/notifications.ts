import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  NotificationPrefsSchema,
  type NotificationKind,
  type NotificationPrefs,
} from "@zeitbruecke/shared";

import { isDemo, supabase } from "@/lib/supabase";

const TOKEN_KEY = "zeitbruecke.pushToken.v1";
const DEMO_PREFS_KEY = "zeitbruecke.notificationPrefs.demo.v1";

/**
 * Banner im Vordergrund nur zeigen, wenn der Nutzer NICHT gerade im betroffenen
 * Chat ist (dort zeigt Realtime die Nachricht ohnehin).
 */
let activeChatMatchId: string | null = null;
export function setActiveChat(matchId: string | null): void {
  activeChatMatchId = matchId;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { match_id?: string } | undefined;
    const inThisChat = !!data?.match_id && data.match_id === activeChatMatchId;
    return {
      shouldShowBanner: !inThisChat,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});

export type PermissionStatus = "granted" | "denied" | "undetermined";

export async function getPermissionStatus(): Promise<PermissionStatus> {
  if (isDemo) return "undetermined";
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return "granted";
  if (settings.canAskAgain) return "undetermined";
  return "denied";
}

/** Fragt die Berechtigung an und registriert den Token. Gibt den Status zurück. */
export async function registerForPushNotifications(): Promise<PermissionStatus> {
  if (isDemo || !supabase) return "undetermined";

  if (!Device.isDevice) {
    // Pushes brauchen ein echtes Gerät (kein Simulator/Expo Go).
    return "undetermined";
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Standard",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status: PermissionStatus = existing.granted ? "granted" : "undetermined";
  if (!existing.granted && existing.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.granted ? "granted" : requested.canAskAgain ? "undetermined" : "denied";
  } else if (!existing.granted) {
    status = "denied";
  }
  if (status !== "granted") return status;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined;

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const expoToken = tokenResponse.data;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return status;

    await supabase
      .from("push_tokens")
      .upsert(
        { profile_id: userId, expo_token: expoToken, platform: Platform.OS },
        { onConflict: "expo_token" },
      );
    await AsyncStorage.setItem(TOKEN_KEY, expoToken);
  } catch {
    // Ohne EAS-Projekt / in Expo Go nicht möglich – kein harter Fehler.
  }
  return status;
}

/** Beim Logout den eigenen Token entfernen. */
export async function deletePushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (token && supabase) {
    await supabase.from("push_tokens").delete().eq("expo_token", token);
  }
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
}

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  if (isDemo || !supabase) {
    const raw = await AsyncStorage.getItem(DEMO_PREFS_KEY).catch(() => null);
    return raw ? (JSON.parse(raw) as NotificationPrefs) : {};
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return {};
  const { data } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", userId)
    .maybeSingle();
  const parsed = NotificationPrefsSchema.safeParse(data?.notification_prefs ?? {});
  return parsed.success ? parsed.data : {};
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  if (isDemo || !supabase) {
    await AsyncStorage.setItem(DEMO_PREFS_KEY, JSON.stringify(prefs)).catch(() => undefined);
    return;
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return;
  await supabase.from("profiles").update({ notification_prefs: prefs }).eq("id", userId);
}

/** Deep-Link-Ziel aus den Daten einer Benachrichtigung. */
export function notificationRouteFor(
  data: Record<string, unknown> | undefined,
): string | null {
  if (!data) return null;
  const kind = data.kind as NotificationKind | undefined;
  const matchId = data.match_id as string | undefined;
  switch (kind) {
    case "request_received":
      return "/(tabs)/anfragen";
    case "request_accepted":
    case "message_received":
    case "meeting_reminder":
      return matchId ? `/chat/${matchId}` : "/(tabs)/chats";
    case "verification_decided":
      return "/(tabs)/profile";
    default:
      return null;
  }
}
