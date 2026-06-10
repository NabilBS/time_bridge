import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  TIME_SLOTS,
  VERIFICATION_TYPE_LABELS,
  VerificationType,
  WEEKDAYS,
} from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import { BodyText, PrimaryButton, ScreenContainer, Title } from "@/components/ui";
import { useOnboarding } from "@/lib/onboarding";
import { isDemo, supabase } from "@/lib/supabase";
import { colors, fontSize, radius, spacing, touchTarget } from "@/lib/theme";
import {
  computeTrustLevel,
  latestByType,
  loadVerifications,
  type VerificationEntry,
} from "@/lib/verifications";

const OFFLINE_MESSAGE =
  "Keine Verbindung – Ihre Eingaben sind gespeichert, bitte versuchen Sie es gleich erneut.";

const VERIFICATION_STATUS_SHORT: Record<string, string> = {
  submitted: "Wird geprüft – Sie hören von uns",
  approved: "Bestätigt",
  rejected: "Bitte erneut einreichen",
  expired: "Bitte erneuern",
};

interface ProfileView {
  displayName: string;
  roleLabel: string;
  isSenior: boolean;
  birthYear: number | null;
  interests: string[];
  district: string;
  postalCode: string;
  bio: string | null;
  trustLevel: number;
  familySummary: string | null;
  careWishes: string | null;
  availabilityText: string | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const { state } = useOnboarding();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [verifications, setVerifications] = useState<VerificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isDemo || !supabase) {
      const entries = await loadVerifications().catch(() => [] as VerificationEntry[]);
      const availabilityText = state.availability
        .map((selection) => {
          const weekday = WEEKDAYS.find((entry) => entry.value === selection.weekday);
          const slot = TIME_SLOTS.find((entry) => entry.id === selection.slotId);
          return weekday && slot ? `${weekday.short} ${slot.label}` : null;
        })
        .filter((entry): entry is string => entry !== null)
        .join(", ");

      setVerifications(entries);
      setProfile({
        displayName: state.displayName || "Demo-Profil",
        roleLabel:
          state.role === "family" ? "Wir suchen Unterstützung" : "Ich möchte Zeit schenken",
        isSenior: state.role !== "family",
        birthYear: state.birthYear,
        interests: state.interests,
        district: state.district ?? "–",
        postalCode: state.postalCode || "–",
        bio: state.bio.trim() ? state.bio.trim() : null,
        trustLevel: computeTrustLevel(entries),
        familySummary:
          state.role === "family"
            ? `${state.childrenCount} Kind(er), ${state.ageMin}–${state.ageMax} Jahre`
            : null,
        careWishes: state.role === "family" ? state.careWishes : null,
        availabilityText: state.role === "senior" ? availabilityText || null : null,
      });
      setError(null);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setError("Sie sind nicht angemeldet.");
      return;
    }

    const { data: row, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !row) {
      setError(profileError ? OFFLINE_MESSAGE : "Es wurde noch kein Profil angelegt.");
      return;
    }

    let familySummary: string | null = null;
    let careWishes: string | null = null;
    let availabilityText: string | null = null;
    let entries: VerificationEntry[] = [];

    if (row.role === "family") {
      const { data: details } = await supabase
        .from("family_details")
        .select("*")
        .eq("profile_id", userId)
        .maybeSingle();
      if (details) {
        familySummary = `${details.children_count} Kind(er), ${details.age_min}–${details.age_max} Jahre`;
        careWishes = details.care_wishes;
      }
    } else {
      const { data: slots } = await supabase
        .from("availabilities")
        .select("weekday, time_from, time_to")
        .eq("profile_id", userId)
        .order("weekday");
      if (slots && slots.length > 0) {
        availabilityText = slots
          .map((slot) => {
            const weekday = WEEKDAYS.find((entry) => entry.value === slot.weekday);
            const timeFrom = String(slot.time_from).slice(0, 5);
            const timeTo = String(slot.time_to).slice(0, 5);
            return `${weekday?.short ?? "?"} ${timeFrom}–${timeTo}`;
          })
          .join(", ");
      }
      entries = await loadVerifications().catch(() => [] as VerificationEntry[]);
    }

    setVerifications(entries);
    setProfile({
      displayName: row.display_name,
      roleLabel: row.role === "family" ? "Wir suchen Unterstützung" : "Ich möchte Zeit schenken",
      isSenior: row.role !== "family",
      birthYear: row.birth_year,
      interests: row.interests ?? [],
      district: row.district,
      postalCode: row.postal_code,
      bio: row.bio,
      trustLevel: row.trust_level ?? 1,
      familySummary,
      careWishes,
      availabilityText,
    });
    setError(null);
  }, [state]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => setError(OFFLINE_MESSAGE))
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load()
      .catch(() => setError(OFFLINE_MESSAGE))
      .finally(() => setRefreshing(false));
  }, [load]);

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (error || !profile) {
    return (
      <ScreenContainer scroll={false}>
        <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
          <BodyText>{error ?? "Es wurde noch kein Profil angelegt."}</BodyText>
          <PrimaryButton label="Erneut versuchen" onPress={onRefresh} />
        </View>
      </ScreenContainer>
    );
  }

  const byType = latestByType(verifications);

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <DemoBanner />
      <Title>{profile.displayName}</Title>
      <View style={styles.trustBadge}>
        <Text style={styles.trustText}>Vertrauensstufe {profile.trustLevel} von 3</Text>
      </View>
      <BodyText muted>Mit jeder Vertrauensstufe wird Ihr Profil sichtbarer.</BodyText>

      {profile.isSenior ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ihre Nachweise</Text>
          {VerificationType.options.map((type) => {
            const entry = byType[type];
            const statusText = entry
              ? VERIFICATION_STATUS_SHORT[entry.status]
              : "Noch nicht eingereicht";
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                onPress={() => router.push(`/verifizierung/${type}`)}
                style={({ pressed }) => [styles.verificationRow, pressed && { opacity: 0.8 }]}
              >
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={styles.rowValue}>{VERIFICATION_TYPE_LABELS[type]}</Text>
                  <Text
                    style={[
                      styles.rowLabel,
                      entry?.status === "approved" && styles.statusApproved,
                    ]}
                  >
                    {statusText}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.card}>
        <Row label="Rolle" value={profile.roleLabel} />
        {profile.birthYear ? <Row label="Geburtsjahr" value={String(profile.birthYear)} /> : null}
        {profile.interests.length > 0 ? (
          <Row label="Interessen" value={profile.interests.join(", ")} />
        ) : null}
        {profile.familySummary ? <Row label="Kinder" value={profile.familySummary} /> : null}
        {profile.careWishes ? <Row label="Ihr Wunsch" value={profile.careWishes} /> : null}
        {profile.availabilityText ? (
          <Row label="Verfügbarkeit" value={profile.availabilityText} />
        ) : null}
        <Row label="Bezirk" value={profile.district} />
        <Row label="Postleitzahl" value={profile.postalCode} />
        {profile.bio ? <Row label="Kurzvorstellung" value={profile.bio} /> : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  trustBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  trustText: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: "700",
    color: colors.text,
  },
  verificationRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: touchTarget.minHeight,
    gap: spacing.sm,
  },
  chevron: {
    fontSize: fontSize.title,
    color: colors.textMuted,
  },
  statusApproved: {
    color: colors.primary,
    fontWeight: "600",
  },
  row: {
    gap: spacing.xs,
  },
  rowLabel: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: fontSize.bodyLarge,
    color: colors.text,
    fontWeight: "600",
  },
});
