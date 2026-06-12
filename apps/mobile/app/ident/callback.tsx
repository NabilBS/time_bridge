import { useRouter } from "expo-router";
import { View } from "react-native";

import { BodyText, PrimaryButton, ScreenContainer, Title } from "@/components/ui";
import { spacing } from "@/lib/theme";

/** Rückkehr vom Ident-Anbieter (zeitbruecke://ident/callback). */
export default function IdentCallback() {
  const router = useRouter();

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
        <Title>Vielen Dank!</Title>
        <BodyText>
          Ihre Identifizierung wird jetzt geprüft – das Ergebnis kommt in wenigen Minuten. Sie
          sehen es auf der Seite Ihrer Vertrauensstufe.
        </BodyText>
      </View>
      <PrimaryButton
        label="Zum Status"
        onPress={() => router.replace("/verifizierung/video_ident")}
      />
    </ScreenContainer>
  );
}
