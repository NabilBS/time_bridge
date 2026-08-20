import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  BERLIN_DISTRICTS,
  SearchFilterSchema,
  type Role,
  type SearchFilter,
} from "@zeitbruecke/shared";

import { Avatar } from "@/components/Avatar";
import { DemoBanner } from "@/components/DemoBanner";
import { TrustBadge } from "@/components/TrustBadge";
import { BodyText, Chip, ScreenContainer, SecondaryButton, Title } from "@/components/ui";
import {
  discoverProfiles,
  OFFLINE_MESSAGE,
  PAGE_SIZE,
  type DiscoverProfile,
} from "@/lib/matching";
import { useOnboarding } from "@/lib/onboarding";
import { isDemo, supabase } from "@/lib/supabase";
import {
  avatarSize,
  colors,
  fontSize,
  fontWeight,
  opacity,
  radius,
  spacing,
  touchTarget,
} from "@/lib/theme";

export default function Discover() {
  const router = useRouter();
  const { state } = useOnboarding();
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [filter, setFilter] = useState<SearchFilter>(SearchFilterSchema.parse({}));
  const [ownInterests, setOwnInterests] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveSelf = useCallback(async (): Promise<{ role: Role; interests: string[] }> => {
    if (isDemo || !supabase) {
      return { role: state.role ?? "family", interests: state.interests };
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) throw new Error("Sie sind nicht angemeldet.");
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("role, interests")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !data) throw new Error(OFFLINE_MESSAGE);
    return { role: data.role as Role, interests: (data.interests as string[]) ?? [] };
  }, [state.role, state.interests]);

  const load = useCallback(
    async (targetPage: number, replace: boolean) => {
      try {
        const self = await resolveSelf();
        setOwnInterests(self.interests);
        const results = await discoverProfiles(self.role, filter, targetPage);
        setProfiles((current) => (replace ? results : [...current, ...results]));
        setPage(targetPage);
        setHasMore(results.length === PAGE_SIZE);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : OFFLINE_MESSAGE);
      }
    },
    [filter, resolveSelf],
  );

  useFocusEffect(
    useCallback(() => {
      load(0, true);
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(0, true).finally(() => setRefreshing(false));
  }, [load]);

  function updateFilter(partial: Partial<SearchFilter>) {
    setFilter((current) => ({ ...current, ...partial }));
  }

  const interestsActive = filter.interests.length > 0;

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <DemoBanner />
      <Title>Entdecken</Title>
      <BodyText muted>
        {state.role === "senior"
          ? "Familien in Ihrem Kiez, die sich über Ihre Zeit freuen."
          : "Senioren in Ihrem Kiez, die Zeit schenken möchten."}
      </BodyText>

      <SecondaryButton
        label={showFilters ? "Filter ausblenden" : "Filter anzeigen"}
        onPress={() => setShowFilters((value) => !value)}
      />

      {showFilters ? (
        <View style={styles.filterBox}>
          <Text style={styles.filterLabel}>Bezirk</Text>
          <View style={styles.chipWrap}>
            <Chip
              label="Alle"
              selected={filter.district === null}
              onPress={() => updateFilter({ district: null })}
            />
            {BERLIN_DISTRICTS.map((district) => (
              <Chip
                key={district}
                label={district}
                selected={filter.district === district}
                onPress={() => updateFilter({ district })}
              />
            ))}
          </View>
          <Text style={styles.filterLabel}>Mindest-Vertrauensstufe</Text>
          <View style={styles.chipWrap}>
            {[1, 2, 3].map((level) => (
              <Chip
                key={level}
                label={`Stufe ${level}`}
                selected={filter.min_trust_level === level}
                onPress={() => updateFilter({ min_trust_level: level })}
              />
            ))}
          </View>
          <Text style={styles.filterLabel}>Interessen</Text>
          <Chip
            label="Nur gemeinsame Interessen"
            selected={interestsActive}
            onPress={() =>
              updateFilter({ interests: interestsActive ? [] : ownInterests })
            }
          />
        </View>
      ) : null}

      {error ? <BodyText>{error}</BodyText> : null}

      {!error && profiles.length === 0 ? (
        <BodyText muted>
          Hier ist gerade niemand zu sehen – versuchen Sie es mit weniger Filtern oder schauen
          Sie später wieder vorbei.
        </BodyText>
      ) : null}

      {profiles.map((profile) => (
        <Pressable
          key={profile.id}
          accessibilityRole="button"
          onPress={() => router.push(`/profil-detail/${profile.id}`)}
          style={({ pressed }) => [styles.card, pressed && { opacity: opacity.pressed }]}
        >
          <View style={styles.cardHeader}>
            <Avatar
              name={profile.display_name}
              photoPath={profile.photo_path}
              size={avatarSize.md}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{profile.display_name}</Text>
              <Text style={styles.cardMeta}>{profile.district}</Text>
            </View>
          </View>
          <TrustBadge level={profile.trust_level} />
          {profile.interests.length > 0 ? (
            <Text style={styles.cardInterests}>{profile.interests.join(" · ")}</Text>
          ) : null}
        </Pressable>
      ))}

      {hasMore ? <SecondaryButton label="Mehr anzeigen" onPress={() => load(page + 1, false)} /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterLabel: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: touchTarget.buttonHeight,
  },
  cardName: {
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  cardMeta: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  cardInterests: {
    fontSize: fontSize.body,
    color: colors.text,
  },
});
