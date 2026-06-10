import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { DemoBanner } from "@/components/DemoBanner";
import { BodyText, PrimaryButton, ScreenContainer, SecondaryButton, Title } from "@/components/ui";
import { isDemo } from "@/lib/supabase";
import { registerForPushNotifications } from "@/lib/notifications";
import { spacing } from "@/lib/theme";

export default function NotificationOptIn() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleEnable() {
    setBusy(true);
    try {
      // Erst unser Screen, dann der System-Dialog (bessere Opt-in-Quote).
      await registerForPushNotifications();
    } finally {
      setBusy(false);
      router.replace("/einstellungen/benachrichtigungen");
    }
  }

  return (
    <ScreenContainer scroll={false}>
      <DemoBanner />
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
        <Title>Möchten Sie benachrichtigt werden, wenn jemand Ihnen schreibt?</Title>
        <BodyText>
          So verpassen Sie keine Anfrage und keine Nachricht – auch dann nicht, wenn die App
          gerade geschlossen ist.
        </BodyText>
        <BodyText muted>
          Wir benachrichtigen Sie nur über das Nötige und nennen nie den Inhalt Ihrer
          Nachrichten. Sie können das später jederzeit in den Einstellungen ändern.
        </BodyText>
        {isDemo ? (
          <BodyText muted>
            Hinweis: Im Demo-Modus werden keine echten Benachrichtigungen verschickt.
          </BodyText>
        ) : null}
      </View>
      <PrimaryButton
        label={busy ? "Einen Moment …" : "Ja, gern"}
        onPress={handleEnable}
        disabled={busy}
      />
      <SecondaryButton label="Vielleicht später" onPress={() => router.back()} />
    </ScreenContainer>
  );
}
