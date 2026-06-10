import { useLocalSearchParams, useRouter } from "expo-router";
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
import {
  loadMatchHeader,
  loadMessages,
  OFFLINE_MESSAGE,
  sendChatMessage,
  subscribeToMessages,
  type ChatMessage,
} from "@/lib/matching";
import { colors, fontSize, radius, spacing, touchTarget } from "@/lib/theme";

export default function Chat() {
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId?: string }>();
  const matchId = typeof params.matchId === "string" ? params.matchId : null;

  const [selfId, setSelfId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState("");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerActive, setPartnerActive] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((current) =>
      current.some((entry) => entry.id === message.id) ? current : [...current, message],
    );
  }, []);

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

  async function handleSend() {
    if (!matchId || !selfId) return;
    const body = draft.trim();
    if (!body) return;

    // Optimistisch anzeigen, bei Fehler zurückrollen.
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
      setMessages((current) =>
        current.map((entry) => (entry.id === temporaryId ? saved : entry)),
      );
      if (matchId) {
        // Demo: feste Antwort des Gegenübers nachladen
        const refreshed = await loadMessages(matchId);
        setMessages((current) => (refreshed.length > current.length ? refreshed : current));
      }
    } catch {
      setMessages((current) => current.filter((entry) => entry.id !== temporaryId));
      setDraft(body);
      setError("Ihre Nachricht konnte nicht gesendet werden – bitte versuchen Sie es erneut.");
    } finally {
      setPendingIds((current) => current.filter((id) => id !== temporaryId));
    }
  }

  if (!matchId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.errorText}>Dieser Chat wurde nicht gefunden.</Text>
      </SafeAreaView>
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
        <View style={styles.tipBanner}>
          <Text style={styles.tipText}>
            Tipp: Verabreden Sie Ihr erstes Treffen an einem Partner-Ort in Ihrer Nähe.
          </Text>
        </View>
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
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: message }) => {
            const own = message.sender_profile === selfId;
            const pending = pendingIds.includes(message.id);
            return (
              <View
                style={[
                  styles.bubble,
                  own ? styles.bubbleOwn : styles.bubbleOther,
                  pending && { opacity: 0.6 },
                ]}
              >
                <Text style={[styles.bubbleText, own && styles.bubbleTextOwn]}>
                  {message.body}
                </Text>
              </View>
            );
          }}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Nachricht schreiben"
            style={[styles.input, !partnerActive && { opacity: 0.5 }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={
              partnerActive ? "Ihre Nachricht …" : "Dieses Profil ist nicht mehr aktiv."
            }
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
              (!partnerActive || !draft.trim()) && { opacity: 0.4 },
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
    fontWeight: "600",
  },
  headerName: {
    flex: 1,
    fontSize: fontSize.subtitle,
    fontWeight: "700",
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
    fontWeight: "600",
  },
  tipBanner: {
    backgroundColor: colors.primarySoft,
    marginHorizontal: spacing.md,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  tipText: {
    fontSize: fontSize.body,
    color: colors.text,
    textAlign: "center",
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
    fontWeight: "600",
  },
  messageList: {
    padding: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
    justifyContent: "flex-end",
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
    lineHeight: fontSize.body * 1.4,
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
    fontWeight: "700",
    color: colors.onPrimary,
  },
});
