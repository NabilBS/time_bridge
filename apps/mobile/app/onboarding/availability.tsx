import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TIME_SLOTS, WEEKDAYS, type TimeSlotId } from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import { ProgressHeader } from "@/components/ProgressHeader";
import { BodyText, Chip, PrimaryButton, ScreenContainer, Title } from "@/components/ui";
import {
  stepProgress,
  useOnboarding,
  type AvailabilitySelection,
} from "@/lib/onboarding";
import { colors, fontSize, fontWeight, spacing } from "@/lib/theme";

export default function Availability() {
  const router = useRouter();
  const { state, dispatch } = useOnboarding();
  const [selection, setSelection] = useState<AvailabilitySelection[]>(state.availability);
  const progress = stepProgress("availability", state.role);

  function isSelected(weekday: number, slotId: TimeSlotId) {
    return selection.some((entry) => entry.weekday === weekday && entry.slotId === slotId);
  }

  function toggle(weekday: number, slotId: TimeSlotId) {
    setSelection((current) =>
      isSelected(weekday, slotId)
        ? current.filter((entry) => !(entry.weekday === weekday && entry.slotId === slotId))
        : [...current, { weekday, slotId }],
    );
  }

  function handleContinue() {
    dispatch({ type: "SET_AVAILABILITY", availability: selection });
    router.push("/onboarding/district");
  }

  return (
    <ScreenContainer>
      {progress ? <ProgressHeader current={progress.current} total={progress.total} /> : null}
      <DemoBanner />
      <Title>Wann haben Sie Zeit?</Title>
      <BodyText muted>
        Wählen Sie Ihre Zeitfenster – Sie können das später jederzeit ändern.
      </BodyText>
      {WEEKDAYS.map((weekday) => (
        <View key={weekday.value} style={styles.dayBlock}>
          <Text style={styles.dayLabel}>{weekday.label}</Text>
          <View style={styles.slotRow}>
            {TIME_SLOTS.map((slot) => (
              <Chip
                key={slot.id}
                label={`${slot.label} ${slot.timeFrom}–${slot.timeTo}`}
                selected={isSelected(weekday.value, slot.id)}
                onPress={() => toggle(weekday.value, slot.id)}
              />
            ))}
          </View>
        </View>
      ))}
      <PrimaryButton label="Weiter" onPress={handleContinue} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dayBlock: {
    gap: spacing.sm,
  },
  dayLabel: {
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  slotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
