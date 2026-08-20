import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import {
  NOTIFICATION_CATEGORY_LABELS,
  NotificationKind,
  type NotificationPrefs,
} from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import { BodyText, ScreenContainer, Title } from "@/components/ui";
import { isDemo } from "@/lib/supabase";
import {
  getPermissionStatus,
  loadNotificationPrefs,
  saveNotificationPrefs,
  type PermissionStatus,
} from "@/lib/notifications";
import { colors, fontSize, fontWeight, radius, spacing, touchTarget } from "@/lib/theme";

export default function NotificationSettings() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPrefs>({});
  const [permission, setPermission] = useState<PermissionStatus>("undetermined");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [loadedPrefs, status] = await Promise.all([
      loadNotificationPrefs(),
      getPermissionStatus(),
    ]);
    setPrefs(loadedPrefs);
    setPermission(status);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(kind: NotificationKind, enabled: boolean) {
    const next: NotificationPrefs = { ...prefs, [kind]: enabled };
    setPrefs(next);
    await saveNotificationPrefs(next);
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
      <Title>Benachrichtigungen</Title>
      <BodyText muted>Wählen Sie, worüber wir Sie informieren dürfen.</BodyText>

      {!isDemo && permission === "denied" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => Linking.openSettings()}
          style={styles.permissionHint}
        >
          <Text style={styles.permissionText}>
            Benachrichtigungen sind in Ihren Geräte-Einstellungen ausgeschaltet. Tippen Sie hier,
            um sie zu erlauben.
          </Text>
        </Pressable>
      ) : null}

      {isDemo ? (
        <BodyText muted>
          Im Demo-Modus werden keine echten Benachrichtigungen verschickt – die Schalter werden
          aber gespeichert.
        </BodyText>
      ) : null}

      {!loading
        ? NotificationKind.options.map((kind) => (
            <View key={kind} style={styles.row}>
              <Text style={styles.rowLabel}>{NOTIFICATION_CATEGORY_LABELS[kind]}</Text>
              <Switch
                value={prefs[kind] !== false}
                onValueChange={(value) => toggle(kind, value)}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel={NOTIFICATION_CATEGORY_LABELS[kind]}
              />
            </View>
          ))
        : null}
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
    fontWeight: fontWeight.semibold,
  },
  permissionHint: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  permissionText: {
    fontSize: fontSize.body,
    color: colors.warning,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: touchTarget.minHeight,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    flex: 1,
    fontSize: fontSize.bodyLarge,
    color: colors.text,
  },
});
