import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, radius, spacing } from "@/lib/theme";

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
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  text: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.primaryStrong,
  },
});
