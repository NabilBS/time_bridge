import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CARE_WISHES_MAX_LENGTH, WEEKDAYS, type MatchRequestStatus } from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import { TrustBadge } from "@/components/TrustBadge";
import {
  BodyText,
  FieldError,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  TextField,
  Title,
} from "@/components/ui";
import {
  existingRequestTo,
  loadProfileDetail,
  OFFLINE_MESSAGE,
  sendMatchRequest,
  type DiscoverProfile,
} from "@/lib/matching";
import { colors, fontSize, radius, spacing, touchTarget } from "@/lib/theme";

export default function ProfileDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const profileId = typeof params.id === "string" ? params.id : null;

  const [profile, setProfile] = useState<DiscoverProfile | null>(null);
  const [availability, setAvailability] = useState<
    { weekday: number; time_from: string; time_to: string }[]
  >([]);
  const [requestStatus, setRequestStatus] = useState<MatchRequestStatus | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profileId) return;
    try {
      const [detail, status] = await Promise.all([
        loadProfileDetail(profileId),
        existingRequestTo(profileId),
      ]);
      setProfile(detail.profile);
      setAvailability(detail.availability);
      setRequestStatus(status);
      setLoadError(null);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : OFFLINE_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    if (!profileId) return;
    setSending(true);
    setError(null);
    try {
      await sendMatchRequest(profileId, message);
      setSent(true);
      setRequestStatus("pending");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : OFFLINE_MESSAGE);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <BackRow onPress={() => router.back()} />
        <BodyText muted>Profil wird geladen …</BodyText>
      </ScreenContainer>
    );
  }

  if (!profileId || loadError || !profile) {
    return (
      <ScreenContainer>
        <BackRow onPress={() => router.back()} />
        <Title>{loadError ?? "Dieses Profil ist nicht mehr aktiv."}</Title>
        <SecondaryButton label="Zurück" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <BackRow onPress={() => router.back()} />
      <DemoBanner />
      <Title>{profile.display_name}</Title>
      <TrustBadge level={profile.trust_level} />
      <BodyText muted>
        {profile.role === "senior" ? "Möchte Zeit schenken" : "Sucht Unterstützung"} ·{" "}
        {profile.district}
      </BodyText>
      {profile.bio ? <BodyText>{profile.bio}</BodyText> : null}

      {profile.interests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interessen</Text>
          <BodyText>{profile.interests.join(" · ")}</BodyText>
        </View>
      ) : null}

      {availability.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verfügbarkeit</Text>
          <BodyText>
            {availability
              .map((slot) => {
                const weekday = WEEKDAYS.find((entry) => entry.value === slot.weekday);
                return `${weekday?.short ?? "?"} ${slot.time_from}–${slot.time_to}`;
              })
              .join(", ")}
          </BodyText>
        </View>
      ) : null}

      {sent || requestStatus === "pending" ? (
        <View style={styles.sentBox}>
          <BodyText>
            Anfrage verschickt – wenn {profile.display_name} zustimmt, können Sie sich
            schreiben.
          </BodyText>
        </View>
      ) : requestStatus === "accepted" ? (
        <View style={styles.sentBox}>
          <BodyText>Sie sind bereits verbunden – schauen Sie in Ihre Chats.</BodyText>
        </View>
      ) : (
        <>
          <TextField
            label="Ihre Nachricht (optional)"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={CARE_WISHES_MAX_LENGTH}
            placeholder={`Schreiben Sie ${profile.display_name} ein paar Worte …`}
          />
          <FieldError message={error} />
          <PrimaryButton
            label={sending ? "Wird gesendet …" : "Anfrage senden"}
            onPress={handleSend}
            disabled={sending}
          />
        </>
      )}

      <SecondaryButton
        label="Profil melden"
        onPress={() => router.push(`/melden/${profile.id}`)}
      />
    </ScreenContainer>
  );
}

function BackRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Zurück"
      onPress={onPress}
      style={styles.backButton}
    >
      <Text style={styles.backLabel}>‹ Zurück</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    minHeight: touchTarget.minHeight,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  backLabel: {
    fontSize: fontSize.bodyLarge,
    color: colors.primary,
    fontWeight: "600",
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  sentBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
