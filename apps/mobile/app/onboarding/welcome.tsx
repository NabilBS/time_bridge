import { useRouter } from "expo-router";
import { View } from "react-native";

import { DemoBanner } from "@/components/DemoBanner";
import { BodyText, PrimaryButton, ScreenContainer, Title } from "@/components/ui";
import { spacing } from "@/lib/theme";

export default function Welcome() {
  const router = useRouter();

  return (
    <ScreenContainer scroll={false}>
      <DemoBanner />
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
        <Title>Zeit, die verbindet.</Title>
        <BodyText>
          Zeitbrücke bringt Senioren und Familien im Kiez zusammen – sicher, geprüft und auf
          Augenhöhe.
        </BodyText>
      </View>
      <PrimaryButton label="Los geht's" onPress={() => router.push("/onboarding/signin")} />
    </ScreenContainer>
  );
}
