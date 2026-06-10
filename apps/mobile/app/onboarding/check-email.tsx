import { useRouter } from "expo-router";
import { View } from "react-native";

import { BodyText, ScreenContainer, SecondaryButton, Title } from "@/components/ui";
import { useOnboarding } from "@/lib/onboarding";
import { spacing } from "@/lib/theme";

export default function CheckEmail() {
  const router = useRouter();
  const { state } = useOnboarding();

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
        <Title>Bitte prüfen Sie Ihre E-Mails</Title>
        <BodyText>
          Wir haben Ihnen einen Anmelde-Link an {state.email} geschickt. Bitte öffnen Sie die
          E-Mail auf diesem Gerät.
        </BodyText>
        <BodyText muted>
          Keine E-Mail erhalten? Schauen Sie bitte auch im Spam-Ordner nach.
        </BodyText>
      </View>
      <SecondaryButton
        label="Andere E-Mail-Adresse verwenden"
        onPress={() => router.back()}
      />
    </ScreenContainer>
  );
}
