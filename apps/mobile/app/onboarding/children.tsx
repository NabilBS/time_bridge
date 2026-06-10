import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  CHILD_AGE_MAX,
  CHILD_AGE_MIN,
  CHILDREN_COUNT_MAX,
  CHILDREN_COUNT_MIN,
} from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import { ProgressHeader } from "@/components/ProgressHeader";
import {
  BodyText,
  Chip,
  FieldError,
  PrimaryButton,
  ScreenContainer,
  Stepper,
  Title,
} from "@/components/ui";
import { stepProgress, useOnboarding } from "@/lib/onboarding";
import { colors, fontSize, radius, spacing } from "@/lib/theme";

const AGES = Array.from(
  { length: CHILD_AGE_MAX - CHILD_AGE_MIN + 1 },
  (_, index) => CHILD_AGE_MIN + index,
);

function AgeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (age: number) => void;
}) {
  return (
    <View style={styles.ageGroup}>
      <Text style={styles.ageLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ageRow}>
        {AGES.map((age) => (
          <Chip key={age} label={String(age)} selected={age === value} onPress={() => onChange(age)} />
        ))}
      </ScrollView>
    </View>
  );
}

export default function Children() {
  const router = useRouter();
  const { state, dispatch } = useOnboarding();
  const [childrenCount, setChildrenCount] = useState(state.childrenCount);
  const [ageMin, setAgeMin] = useState(state.ageMin);
  const [ageMax, setAgeMax] = useState(state.ageMax);
  const [ageError, setAgeError] = useState<string | null>(null);
  const progress = stepProgress("children", state.role);

  function handleContinue() {
    if (ageMax < ageMin) {
      setAgeError("Das höchste Alter darf nicht kleiner als das niedrigste sein.");
      return;
    }
    dispatch({ type: "SET_CHILDREN", childrenCount, ageMin, ageMax });
    router.push("/onboarding/wishes");
  }

  return (
    <ScreenContainer>
      {progress ? <ProgressHeader current={progress.current} total={progress.total} /> : null}
      <DemoBanner />
      <Title>Ihre Kinder</Title>
      <View style={styles.privacyNote}>
        <BodyText>Wir fragen bewusst keine Namen oder Fotos Ihrer Kinder ab.</BodyText>
      </View>
      <Stepper
        label="Anzahl der Kinder"
        value={childrenCount}
        min={CHILDREN_COUNT_MIN}
        max={CHILDREN_COUNT_MAX}
        onChange={setChildrenCount}
      />
      <AgeRow
        label="Alter des jüngsten Kindes"
        value={ageMin}
        onChange={(age) => {
          setAgeMin(age);
          if (ageError) setAgeError(null);
        }}
      />
      <AgeRow
        label="Alter des ältesten Kindes"
        value={ageMax}
        onChange={(age) => {
          setAgeMax(age);
          if (ageError) setAgeError(null);
        }}
      />
      <FieldError message={ageError} />
      <PrimaryButton label="Weiter" onPress={handleContinue} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  privacyNote: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  ageGroup: {
    gap: spacing.sm,
  },
  ageLabel: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  ageRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
