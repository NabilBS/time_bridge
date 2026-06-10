import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { CARE_WISHES_MAX_LENGTH } from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import { ProgressHeader } from "@/components/ProgressHeader";
import { BodyText, PrimaryButton, ScreenContainer, TextField, Title } from "@/components/ui";
import { stepProgress, useOnboarding } from "@/lib/onboarding";
import { spacing } from "@/lib/theme";

export default function Wishes() {
  const router = useRouter();
  const { state, dispatch } = useOnboarding();
  const [careWishes, setCareWishes] = useState(state.careWishes);
  const [error, setError] = useState<string | null>(null);
  const progress = stepProgress("wishes", state.role);

  function handleContinue() {
    const trimmed = careWishes.trim();
    if (!trimmed) {
      setError("Bitte beschreiben Sie kurz, wobei Sie sich Unterstützung wünschen.");
      return;
    }
    dispatch({ type: "SET_CARE_WISHES", careWishes: trimmed });
    router.push("/onboarding/district");
  }

  return (
    <ScreenContainer>
      {progress ? <ProgressHeader current={progress.current} total={progress.total} /> : null}
      <DemoBanner />
      <Title>Wobei wünschen Sie sich Unterstützung?</Title>
      <BodyText muted>
        Zum Beispiel: Vorlesen am Nachmittag, Begleitung zum Spielplatz oder Hilfe bei den
        Hausaufgaben.
      </BodyText>
      <TextField
        label="Ihr Wunsch"
        value={careWishes}
        onChangeText={(text) => {
          setCareWishes(text);
          if (error) setError(null);
        }}
        error={error}
        multiline
        maxLength={CARE_WISHES_MAX_LENGTH}
        placeholder="Beschreiben Sie hier Ihren Wunsch …"
      />
      <View style={{ flex: 1, minHeight: spacing.md }} />
      <PrimaryButton label="Weiter" onPress={handleContinue} />
    </ScreenContainer>
  );
}
