import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DemoBanner } from "@/components/DemoBanner";
import { BodyText, ScreenContainer, SecondaryButton, Title } from "@/components/ui";
import { deletePushToken } from "@/lib/notifications";
import { useOnboarding } from "@/lib/onboarding";
import { isDemo, supabase } from "@/lib/supabase";
import { colors, fontSize, radius, spacing, touchTarget } from "@/lib/theme";

const LEGAL_LINKS = [
  { label: "Datenschutzerklärung", url: process.env.EXPO_PUBLIC_PRIVACY_URL },
  { label: "AGB", url: process.env.EXPO_PUBLIC_TERMS_URL },
  { label: "Impressum", url: process.env.EXPO_PUBLIC_IMPRINT_URL },
];

function NavRow({
  label,
  onPress,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.navLabel, danger && { color: colors.error }]}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function Settings() {
  const router = useRouter();
  const { clear } = useOnboarding();
  const [hint, setHint] = useState<string | null>(null);
  const appVersion = Constants.expoConfig?.version ?? "–";

  async function openLegal(label: string, url: string | undefined) {
    if (!url) {
      setHint(
        `${label}: Der Link ist noch nicht hinterlegt (Platzhalter) – er wird vor dem Start ergänzt.`,
      );
      return;
    }
    setHint(null);
    await WebBrowser.openBrowserAsync(url).catch(() =>
      setHint("Die Seite konnte nicht geöffnet werden – bitte versuchen Sie es später erneut."),
    );
  }

  async function handleLogout() {
    await deletePushToken().catch(() => undefined);
    if (supabase) await supabase.auth.signOut().catch(() => undefined);
    await clear();
    router.replace("/");
  }

  return (
    <ScreenContainer>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zurück"
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Text style={styles.backLabel}>‹ Zurück</Text>
      </Pressable>
      <DemoBanner />
      <Title>Einstellungen</Title>

      <View style={styles.card}>
        <NavRow
          label="Benachrichtigungen"
          onPress={() => router.push("/einstellungen/benachrichtigungen")}
        />
      </View>

      <Text style={styles.sectionTitle}>Rechtliches</Text>
      <View style={styles.card}>
        {LEGAL_LINKS.map((entry) => (
          <NavRow
            key={entry.label}
            label={entry.label}
            onPress={() => openLegal(entry.label, entry.url)}
          />
        ))}
      </View>
      {hint ? <BodyText muted>{hint}</BodyText> : null}

      {isDemo ? (
        <View style={styles.card}>
          <NavRow
            label="Kurzbefragung ansehen (Demo)"
            onPress={() => router.push("/befragung")}
          />
        </View>
      ) : null}

      <View style={styles.versionRow}>
        <Text style={styles.versionText}>App-Version {appVersion}</Text>
      </View>

      <SecondaryButton label="Abmelden" onPress={handleLogout} />
      <View style={styles.card}>
        <NavRow
          label="Konto löschen"
          danger
          onPress={() => router.push("/einstellungen/konto-loeschen")}
        />
      </View>
    </ScreenContainer>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.bodyLarge,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: touchTarget.buttonHeight,
    gap: spacing.sm,
  },
  navLabel: {
    fontSize: fontSize.bodyLarge,
    color: colors.text,
    fontWeight: "600",
  },
  chevron: {
    fontSize: fontSize.title,
    color: colors.textMuted,
  },
  versionRow: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  versionText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
});
