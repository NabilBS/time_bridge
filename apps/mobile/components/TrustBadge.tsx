import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, radius, spacing } from "@/lib/theme";

export function TrustBadge({ level }: { level: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>Vertrauensstufe {level} von 3</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  text: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.primary,
  },
});
