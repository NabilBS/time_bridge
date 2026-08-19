import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, spacing, touchTarget } from "@/lib/theme";

export function ProgressHeader({ current, total }: { current: number; total: number }) {
  const router = useRouter();

  return (
    <View style={styles.row}>
      {router.canGoBack() ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backLabel}>‹ Zurück</Text>
        </Pressable>
      ) : (
        <View style={styles.backButton} />
      )}
      <Text style={styles.progress}>
        Schritt {current} von {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: touchTarget.minHeight,
  },
  backButton: {
    minHeight: touchTarget.minHeight,
    minWidth: touchTarget.minHeight,
    justifyContent: "center",
  },
  backLabel: {
    fontSize: fontSize.bodyLarge,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  progress: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.sm,
  },
});
