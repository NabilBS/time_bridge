import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DemoBanner } from "@/components/DemoBanner";
import { formatDateTime, isPast } from "@/lib/datetime";
import {
  loadMatchHeader,
  loadMessages,
  OFFLINE_MESSAGE,
  sendChatMessage,
  subscribeToMessages,
  type ChatMessage,
} from "@/lib/matching";
import {
  cancelMeeting,
  completeMeeting,
  hasReviewed,
  loadMeetings,
  type MeetingItem,
} from "@/lib/meetings";
import { setActiveChat } from "@/lib/notifications";
import { shouldShowSurvey } from "@/lib/surveys";
import {
  colors,
  fontSize,
  fontWeight,
  lineHeight,
  opacity,
  radius,
  spacing,
  touchTarget,
} from "@/lib/theme";

export default function Chat() {
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId?: string }>();
  const matchId = typeof params.matchId === "string" ? params.matchId : null;

  const [selfId, setSelfId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState("");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerActive, setPartnerActive] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((current) =>
      current.some((entry) => entry.id === message.id) ? current : [...current, message],
    );
  }, []);

  const reloadMeetings = useCallback(async () => {
    if (!matchId) return;
    try {
      const list = await loadMeetings(matchId);
      setMeetings(list);
      const reviewedEntries = await Promise.all(
        list
          .filter((m) => m.status === "completed")
          .map(async (m) => [m.id, await hasReviewed(m.id)] as const),
      );
      setReviewed(Object.fromEntries(reviewedEntries));
    } catch {
      /* Treffen sind nicht kritisch fürs Chatten */
    }
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;

    Promise.all([loadMatchHeader(matchId), loadMessages(matchId)])
      .then(([header, history]) => {
        if (cancelled) return;
        setSelfId(header.selfId);
        setPartnerName(header.partnerName);
        setPartnerId(header.partnerId);
        setPartnerActive(header.partnerActive);
        setMessages(history);
      })
      .catch(() => {
        if (!cancelled) setError(OFFLINE_MESSAGE);
      });

    const unsubscribe = subscribeToMessages(matchId, appendMessage);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [matchId, appendMessage]);

  // Treffen neu laden, sobald der Chat wieder im Fokus ist (nach Planen/Bewerten).
  // Solange dieser Chat offen ist, unterdrückt setActiveChat sein Push-Banner.
  useFocusEffect(
    useCallback(() => {
      reloadMeetings();
      setActiveChat(matchId);
      return () => setActiveChat(null);
    }, [reloadMeetings, matchId]),
  );

  async function handleSend() {
    if (!matchId || !selfId) return;
    const body = draft.trim();
    if (!body) return;

    const temporaryId = `pending-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: temporaryId,
      match_id: matchId,
      sender_profile: selfId,
      body,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setPendingIds((current) => [...current, temporaryId]);
    setDraft("");
    setError(null);

    try {
      const saved = await sendChatMessage(matchId, body);
      setMessages((current) => current.map((entry) => (entry.id === temporaryId ? saved : entry)));
      const refreshed = await loadMessages(matchId);
      setMessages((current) => (refreshed.length > current.length ? refreshed : current));
    } catch {
      setMessages((current) => current.filter((entry) => entry.id !== temporaryId));
      setDraft(body);
      setError("Ihre Nachricht konnte nicht gesendet werden – bitte versuchen Sie es erneut.");
    } finally {
      setPendingIds((current) => current.filter((id) => id !== temporaryId));
    }
  }

  async function handleMeetingAction(action: () => Promise<void>) {
    try {
      await action();
      await reloadMeetings();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : OFFLINE_MESSAGE);
    }
  }

  if (!matchId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.errorText}>Dieser Chat wurde nicht gefunden.</Text>
      </SafeAreaView>
    );
  }

  function renderMeetings() {
    return (
      <View style={styles.meetingsHeader}>
        <View style={styles.tipBanner}>
          <Text style={styles.tipText}>
            Tipp: Verabreden Sie Ihr erstes Treffen an einem Partner-Ort in Ihrer Nähe.
          </Text>
        </View>
        {partnerActive ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/treffen/planen/${matchId}`)}
            style={({ pressed }) => [styles.planButton, pressed && { opacity: opacity.pressed }]}
          >
            <Text style={styles.planButtonLabel}>+ Treffen planen</Text>
          </Pressable>
        ) : null}
        {meetings.map((meeting) => (
          <View key={meeting.id} style={styles.meetingCard}>
            <Text style={styles.meetingWhen}>{formatDateTime(meeting.scheduled_at)}</Text>
            <Text style={styles.meetingWhere}>
              {meeting.locationName ?? "Ort wird noch festgelegt"}
            </Text>
            {meeting.status === "cancelled" ? (
              <Text style={styles.meetingCancelled}>Das Treffen wurde abgesagt.</Text>
            ) : meeting.status === "completed" ? (
              reviewed[meeting.id] ? (
                <Text style={styles.meetingDone}>Bewertet – vielen Dank!</Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(
                      `/treffen/bewerten/${meeting.id}?reviewedId=${partnerId ?? ""}`,
                    )
                  }
                  style={styles.meetingAction}
                >
                  <Text style={styles.meetingActionLabel}>Treffen bewerten</Text>
                </Pressable>
              )
            ) : (
              <View style={styles.meetingActions}>
                {isPast(meeting.scheduled_at) ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      handleMeetingAction(async () => {
                        await completeMeeting(meeting.id);
                        // Kurzbefragung erst ab dem zweiten abgeschlossenen
                        // Treffen, höchstens alle 60 Tage (lib/surveys).
                        if (await shouldShowSurvey()) {
                          router.push("/befragung");
                        }
                      })
                    }
                    style={styles.meetingAction}
                  >
                    <Text style={styles.meetingActionLabel}>Hat stattgefunden</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleMeetingAction(() => cancelMeeting(meeting.id))}
                  style={styles.meetingAction}
                >
                  <Text style={[styles.meetingActionLabel, { color: colors.error }]}>Absagen</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backLabel}>‹</Text>
          </Pressable>
          <Text style={styles.headerName} numberOfLines={1}>
            {partnerName}
          </Text>
          {partnerId ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/melden/${partnerId}`)}
              style={styles.reportButton}
            >
              <Text style={styles.reportLabel}>Melden</Text>
            </Pressable>
          ) : null}
        </View>

        <DemoBanner />
        {!partnerActive ? (
          <View style={styles.inactiveBanner}>
            <Text style={styles.inactiveText}>Dieses Profil ist nicht mehr aktiv.</Text>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(message) => message.id}
          contentContainerStyle={styles.messageList}
          ListHeaderComponent={renderMeetings()}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: message }) => {
            const own = message.sender_profile === selfId;
            const pending = pendingIds.includes(message.id);
            return (
              <View
                style={[
                  styles.bubble,
                  own ? styles.bubbleOwn : styles.bubbleOther,
                  pending && { opacity: opacity.pending },
                ]}
              >
                <Text style={[styles.bubbleText, own && styles.bubbleTextOwn]}>{message.body}</Text>
              </View>
            );
          }}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Nachricht schreiben"
            style={[styles.input, !partnerActive && { opacity: opacity.disabled }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={partnerActive ? "Ihre Nachricht …" : "Dieses Profil ist nicht mehr aktiv."}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            editable={partnerActive}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Senden"
            onPress={handleSend}
            disabled={!partnerActive || !draft.trim()}
            style={[
              styles.sendButton,
              (!partnerActive || !draft.trim()) && { opacity: opacity.disabled },
            ]}
          >
            <Text style={styles.sendLabel}>Senden</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    minHeight: touchTarget.buttonHeight,
    gap: spacing.sm,
  },
  backButton: {
    minWidth: touchTarget.minHeight,
    minHeight: touchTarget.minHeight,
    justifyContent: "center",
  },
  backLabel: {
    fontSize: fontSize.title,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  headerName: {
    flex: 1,
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  reportButton: {
    minHeight: touchTarget.minHeight,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  reportLabel: {
    fontSize: fontSize.body,
    color: colors.error,
    fontWeight: fontWeight.semibold,
  },
  inactiveBanner: {
    backgroundColor: colors.errorSoft,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  inactiveText: {
    fontSize: fontSize.body,
    color: colors.error,
    textAlign: "center",
    fontWeight: fontWeight.semibold,
  },
  meetingsHeader: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  tipBanner: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  tipText: {
    fontSize: fontSize.body,
    color: colors.text,
    textAlign: "center",
  },
  planButton: {
    minHeight: touchTarget.minHeight,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  planButtonLabel: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  meetingCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  meetingWhen: {
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  meetingWhere: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  meetingCancelled: {
    fontSize: fontSize.body,
    color: colors.error,
  },
  meetingDone: {
    fontSize: fontSize.body,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  meetingActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  meetingAction: {
    minHeight: touchTarget.minHeight,
    justifyContent: "center",
  },
  meetingActionLabel: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  messageList: {
    padding: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
  },
  bubble: {
    maxWidth: "85%",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bubbleOwn: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    fontSize: fontSize.body,
    lineHeight: fontSize.body * lineHeight.normal,
    color: colors.text,
  },
  bubbleTextOwn: {
    color: colors.onPrimary,
  },
  errorText: {
    fontSize: fontSize.body,
    color: colors.error,
    paddingHorizontal: spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
  },
  input: {
    flex: 1,
    minHeight: touchTarget.buttonHeight,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  sendButton: {
    minHeight: touchTarget.buttonHeight,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },
  sendLabel: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.onPrimary,
  },
});
