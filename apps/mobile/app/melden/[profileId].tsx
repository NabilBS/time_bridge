import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { REPORT_REASONS, type ReportReasonId } from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import {
  BodyText,
  FieldError,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  SelectCard,
  TextField,
  Title,
} from "@/components/ui";
import { OFFLINE_MESSAGE, reportProfile } from "@/lib/matching";
import { colors, fontSize, radius, spacing, touchTarget } from "@/lib/theme";

export default function Report() {
  const router = useRouter();
  const params = useLocalSearchParams<{ profileId?: string }>();
  const profileId = typeof params.profileId === "string" ? params.profileId : null;

  const [reason, setReason] = useState<ReportReasonId | null>(null);
  const [details, setDetails] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!profileId) return;
    if (!reason) {
      setReasonError("Bitte wählen Sie einen Grund aus.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await reportProfile(profileId, reason, details);
      setDone(true);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : OFFLINE_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  if (!profileId) {
    return (
      <ScreenContainer>
        <Title>Profil nicht gefunden</Title>
        <SecondaryButton label="Zurück" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  if (done) {
    return (
      <ScreenContainer>
        <Title>Danke für Ihre Meldung</Title>
        <BodyText>
          Unser Team schaut sich das an. Wenn nötig, melden wir uns bei Ihnen – Sie müssen
          nichts weiter tun.
        </BodyText>
        <PrimaryButton label="Zurück" onPress={() => router.back()} />
      </ScreenContainer>
    );
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
      <Title>Profil melden</Title>
      <BodyText muted>
        Ihre Meldung wird vertraulich behandelt – die gemeldete Person erfährt nichts davon.
      </BodyText>
      {REPORT_REASONS.map((entry) => (
        <SelectCard
          key={entry.id}
          title={entry.label}
          selected={reason === entry.id}
          onPress={() => {
            setReason(entry.id);
            if (reasonError) setReasonError(null);
          }}
        />
      ))}
      <FieldError message={reasonError} />
      <TextField
        label="Was ist passiert? (optional)"
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={600}
        placeholder="Beschreiben Sie kurz, was vorgefallen ist …"
      />
      <FieldError message={submitError} />
      <PrimaryButton
        label={submitting ? "Wird gesendet …" : "Meldung absenden"}
        onPress={handleSubmit}
        disabled={submitting}
      />
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
});
