import { StyleSheet, Text, View } from "react-native";

import { isDemo } from "@/lib/supabase";
import { colors, fontSize, radius, spacing } from "@/lib/theme";

export function DemoBanner() {
  if (!isDemo) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Demo – Daten werden nicht gespeichert</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.demoBanner,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: {
    fontSize: fontSize.body,
    color: colors.demoBannerText,
    textAlign: "center",
    fontWeight: "600",
  },
});
