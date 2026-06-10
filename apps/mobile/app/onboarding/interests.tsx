import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { INTEREST_SUGGESTIONS } from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import { ProgressHeader } from "@/components/ProgressHeader";
import {
  BodyText,
  Chip,
  FieldError,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  TextField,
  Title,
} from "@/components/ui";
import { stepProgress, useOnboarding } from "@/lib/onboarding";
import { spacing } from "@/lib/theme";

export default function Interests() {
  const router = useRouter();
  const { state, dispatch } = useOnboarding();
  const [selected, setSelected] = useState<string[]>(state.interests);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const progress = stepProgress("interests", state.role);

  const customInterests = selected.filter(
    (interest) => !INTEREST_SUGGESTIONS.includes(interest as (typeof INTEREST_SUGGESTIONS)[number]),
  );

  function toggle(interest: string) {
    setSelected((current) =>
      current.includes(interest)
        ? current.filter((entry) => entry !== interest)
        : [...current, interest],
    );
    if (error) setError(null);
  }

  function addCustom() {
    const trimmed = custom.trim();
    if (!trimmed) return;
    if (!selected.includes(trimmed)) {
      setSelected((current) => [...current, trimmed]);
    }
    setCustom("");
    if (error) setError(null);
  }

  function handleContinue() {
    if (selected.length < 1) {
      setError("Bitte wählen Sie mindestens ein Interesse.");
      return;
    }
    dispatch({ type: "SET_INTERESTS", interests: selected });
    router.push("/onboarding/availability");
  }

  return (
    <ScreenContainer>
      {progress ? <ProgressHeader current={progress.current} total={progress.total} /> : null}
      <DemoBanner />
      <Title>Was machen Sie gern?</Title>
      <BodyText muted>
        Wählen Sie alles aus, was Ihnen Freude macht – das hilft Familien, Sie zu finden.
      </BodyText>
      <View style={styles.chipWrap}>
        {INTEREST_SUGGESTIONS.map((interest) => (
          <Chip
            key={interest}
            label={interest}
            selected={selected.includes(interest)}
            onPress={() => toggle(interest)}
          />
        ))}
        {customInterests.map((interest) => (
          <Chip key={interest} label={interest} selected onPress={() => toggle(interest)} />
        ))}
      </View>
      <FieldError message={error} />
      <TextField
        label="Eigenes Interesse ergänzen"
        value={custom}
        onChangeText={setCustom}
        placeholder="z. B. Schach"
        maxLength={60}
      />
      <SecondaryButton label="Hinzufügen" onPress={addCustom} />
      <View style={{ minHeight: spacing.md }} />
      <PrimaryButton label="Weiter" onPress={handleContinue} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
