import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { DemoBanner } from "@/components/DemoBanner";
import { BodyText, ScreenContainer, Title } from "@/components/ui";
import { loadMatches, OFFLINE_MESSAGE, type MatchItem } from "@/lib/matching";
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

export default function Chats() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMatches(await loadMatches());
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

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <DemoBanner />
      <Title>Chats</Title>
      {error ? <BodyText>{error}</BodyText> : null}
      {!error && matches.length === 0 ? (
        <BodyText muted>
          Noch keine Chats – sobald eine Anfrage angenommen wurde, können Sie sich hier
          schreiben.
        </BodyText>
      ) : null}
      {matches.map((match) => (
        <Pressable
          key={match.id}
          accessibilityRole="button"
          onPress={() => router.push(`/chat/${match.id}`)}
          style={({ pressed }) => [styles.card, pressed && { opacity: opacity.pressed }]}
        >
          <View style={styles.cardHeader}>
            <Avatar
              name={match.partnerName}
              photoPath={match.partnerPhotoPath}
              size={avatarSize.md}
            />
            <Text style={styles.cardName}>{match.partnerName}</Text>
          </View>
          <Text style={styles.cardPreview} numberOfLines={1}>
            {match.lastMessage ?? "Sagen Sie Hallo!"}
          </Text>
          {!match.partnerActive ? (
            <Text style={styles.inactive}>Dieses Profil ist nicht mehr aktiv.</Text>
          ) : null}
        </Pressable>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: touchTarget.buttonHeight,
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
  cardPreview: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  inactive: {
    fontSize: fontSize.body,
    color: colors.error,
  },
});
