import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { DemoBanner } from "@/components/DemoBanner";
import {
  BodyText,
  FieldError,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  Title,
} from "@/components/ui";
import {
  acceptRequest,
  declineRequest,
  loadRequests,
  OFFLINE_MESSAGE,
  withdrawRequest,
  type RequestItem,
} from "@/lib/matching";
import { avatarSize, colors, fontSize, fontWeight, radius, spacing } from "@/lib/theme";

const SENT_STATUS_TEXTS: Record<string, string> = {
  pending: "Wartet auf Antwort",
  accepted: "Angenommen – Sie können sich jetzt schreiben",
  declined: "Wurde abgelehnt – Sie können gern jemand anderen anfragen",
  withdrawn: "Von Ihnen zurückgezogen",
};

export default function Requests() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await loadRequests());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : OFFLINE_MESSAGE);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : OFFLINE_MESSAGE);
    } finally {
      setBusyId(null);
    }
  }

  const received = requests.filter(
    (request) => request.direction === "received" && request.status === "pending",
  );
  const sent = requests.filter((request) => request.direction === "sent");

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <DemoBanner />
      <Title>Anfragen</Title>
      {error ? <BodyText>{error}</BodyText> : null}
      <FieldError message={actionError} />

      <Text style={styles.sectionTitle}>Erhalten</Text>
      {received.length === 0 ? (
        <BodyText muted>
          Noch keine Anfragen – stöbern Sie im Entdecken-Bereich.
        </BodyText>
      ) : (
        received.map((request) => (
          <View key={request.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Avatar
                name={request.otherName}
                photoPath={request.otherPhotoPath}
                size={avatarSize.sm}
              />
              <Text style={styles.cardName}>{request.otherName}</Text>
            </View>
            {request.message ? <BodyText>„{request.message}"</BodyText> : null}
            <PrimaryButton
              label={busyId === request.id ? "Einen Moment …" : "Annehmen"}
              disabled={busyId === request.id}
              onPress={() =>
                run(request.id, async () => {
                  const matchId = await acceptRequest(request.id);
                  router.push(`/chat/${matchId}`);
                })
              }
            />
            <SecondaryButton
              label="Ablehnen"
              onPress={() => run(request.id, () => declineRequest(request.id))}
            />
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Gesendet</Text>
      {sent.length === 0 ? (
        <BodyText muted>
          Sie haben noch keine Anfrage verschickt – im Entdecken-Bereich finden Sie Menschen aus
          Ihrem Kiez.
        </BodyText>
      ) : (
        sent.map((request) => (
          <View key={request.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Avatar
                name={request.otherName}
                photoPath={request.otherPhotoPath}
                size={avatarSize.sm}
              />
              <Text style={styles.cardName}>{request.otherName}</Text>
            </View>
            <BodyText muted>{SENT_STATUS_TEXTS[request.status] ?? request.status}</BodyText>
            {request.status === "pending" ? (
              <SecondaryButton
                label="Zurückziehen"
                onPress={() => run(request.id, () => withdrawRequest(request.id))}
              />
            ) : null}
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardName: {
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});
