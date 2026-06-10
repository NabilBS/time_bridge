import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { TIME_SLOTS, WEEKDAYS } from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import { BodyText, PrimaryButton, ScreenContainer, Title } from "@/components/ui";
import { useOnboarding } from "@/lib/onboarding";
import { isDemo, supabase } from "@/lib/supabase";
import { colors, fontSize, radius, spacing } from "@/lib/theme";

const OFFLINE_MESSAGE =
  "Keine Verbindung – Ihre Eingaben sind gespeichert, bitte versuchen Sie es gleich erneut.";

interface ProfileView {
  displayName: string;
  roleLabel: string;
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
  const { state } = useOnboarding();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      if (isDemo || !supabase) {
        const availabilityText = state.availability
          .map((selection) => {
            const weekday = WEEKDAYS.find((entry) => entry.value === selection.weekday);
            const slot = TIME_SLOTS.find((entry) => entry.id === selection.slotId);
            return weekday && slot ? `${weekday.short} ${slot.label}` : null;
          })
          .filter((entry): entry is string => entry !== null)
          .join(", ");

        setProfile({
          displayName: state.displayName || "Demo-Profil",
          roleLabel:
            state.role === "family" ? "Wir suchen Unterstützung" : "Ich möchte Zeit schenken",
          birthYear: state.birthYear,
          interests: state.interests,
          district: state.district ?? "–",
          postalCode: state.postalCode || "–",
          bio: state.bio.trim() ? state.bio.trim() : null,
          trustLevel: 1,
          familySummary:
            state.role === "family"
              ? `${state.childrenCount} Kind(er), ${state.ageMin}–${state.ageMax} Jahre`
              : null,
          careWishes: state.role === "family" ? state.careWishes : null,
          availabilityText: state.role === "senior" ? availabilityText || null : null,
        });
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        if (!cancelled) {
          setError("Sie sind nicht angemeldet.");
          setLoading(false);
        }
        return;
      }

      const { data: row, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (profileError || !row) {
        setError(profileError ? OFFLINE_MESSAGE : "Es wurde noch kein Profil angelegt.");
        setLoading(false);
        return;
      }

      let familySummary: string | null = null;
      let careWishes: string | null = null;
      let availabilityText: string | null = null;

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
      }
      if (cancelled) return;

      setProfile({
        displayName: row.display_name,
        roleLabel: row.role === "family" ? "Wir suchen Unterstützung" : "Ich möchte Zeit schenken",
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
      setLoading(false);
    }

    load().catch(() => {
      if (!cancelled) {
        setError(OFFLINE_MESSAGE);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

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
          <PrimaryButton label="Erneut versuchen" onPress={() => setAttempt((n) => n + 1)} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <DemoBanner />
      <Title>{profile.displayName}</Title>
      <View style={styles.trustBadge}>
        <Text style={styles.trustText}>Vertrauensstufe {profile.trustLevel} von 3</Text>
      </View>
      <BodyText muted>Mit jeder Vertrauensstufe wird Ihr Profil sichtbarer.</BodyText>
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
