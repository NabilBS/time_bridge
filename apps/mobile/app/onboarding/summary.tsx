import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import {
  AvailabilitySchema,
  FamilyDetailsSchema,
  ProfileSchema,
  TIME_SLOTS,
  WEEKDAYS,
  type Availability,
} from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import { ProgressHeader } from "@/components/ProgressHeader";
import { BodyText, FieldError, PrimaryButton, ScreenContainer, Title } from "@/components/ui";
import { stepProgress, useOnboarding, type OnboardingState } from "@/lib/onboarding";
import { isDemo, supabase } from "@/lib/supabase";
import { colors, fontSize, fontWeight, radius, spacing } from "@/lib/theme";

const OFFLINE_MESSAGE =
  "Keine Verbindung – Ihre Eingaben sind gespeichert, bitte versuchen Sie es gleich erneut.";

// Platzhalter-ID, damit die Zod-Validierung auch im Demo-Modus läuft.
const DEMO_PROFILE_ID = "00000000-0000-4000-8000-000000000000";

function buildProfile(state: OnboardingState, userId: string) {
  return ProfileSchema.parse({
    id: userId,
    role: state.role,
    display_name: state.displayName,
    birth_year: state.birthYear,
    interests: state.interests,
    district: state.district,
    postal_code: state.postalCode,
    bio: state.bio.trim() ? state.bio.trim() : null,
  });
}

function buildFamilyDetails(state: OnboardingState, userId: string) {
  return FamilyDetailsSchema.parse({
    profile_id: userId,
    children_count: state.childrenCount,
    age_min: state.ageMin,
    age_max: state.ageMax,
    care_wishes: state.careWishes,
  });
}

function buildAvailabilities(state: OnboardingState, userId: string): Availability[] {
  return state.availability.map((selection) => {
    const slot = TIME_SLOTS.find((entry) => entry.id === selection.slotId);
    if (!slot) {
      throw new Error(`Unbekanntes Zeitfenster: ${selection.slotId}`);
    }
    return AvailabilitySchema.parse({
      profile_id: userId,
      weekday: selection.weekday,
      time_from: slot.timeFrom,
      time_to: slot.timeTo,
    });
  });
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function Summary() {
  const router = useRouter();
  const { state, dispatch, clear } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const progress = stepProgress("summary", state.role);

  const availabilityText = state.availability
    .map((selection) => {
      const weekday = WEEKDAYS.find((entry) => entry.value === selection.weekday);
      const slot = TIME_SLOTS.find((entry) => entry.id === selection.slotId);
      return weekday && slot ? `${weekday.short} ${slot.label}` : null;
    })
    .filter((entry): entry is string => entry !== null)
    .join(", ");

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      if (isDemo || !supabase) {
        // Demo: nur validieren und lokal abschließen, nichts speichern.
        buildProfile(state, DEMO_PROFILE_ID);
        if (state.role === "family") buildFamilyDetails(state, DEMO_PROFILE_ID);
        else buildAvailabilities(state, DEMO_PROFILE_ID);
        dispatch({ type: "COMPLETE_DEMO" });
        router.replace("/(tabs)/profile");
        return;
      }

      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) {
        router.replace("/onboarding/signin");
        return;
      }

      const profile = buildProfile(state, userId);
      // ignoreDuplicates: Retry nach Teilerfolg überspringt den bestehenden
      // Profil-Insert (DO NOTHING) – ein Update wäre an den Spalten-Grants
      // aus 0009 gescheitert (role/id sind für Nutzer nicht änderbar).
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profile, { onConflict: "id", ignoreDuplicates: true });
      if (profileError) throw profileError;

      if (state.role === "family") {
        const familyDetails = buildFamilyDetails(state, userId);
        const { error: familyError } = await supabase
          .from("family_details")
          .upsert(familyDetails, { onConflict: "profile_id" });
        if (familyError) throw familyError;
      } else {
        const availabilities = buildAvailabilities(state, userId);
        if (availabilities.length > 0) {
          const { error: availabilityError } = await supabase
            .from("availabilities")
            .upsert(availabilities, {
              onConflict: "profile_id,weekday,time_from,time_to",
              ignoreDuplicates: true,
            });
          if (availabilityError) throw availabilityError;
        }
      }

      await clear();
      router.replace("/(tabs)/profile");
    } catch (caught) {
      if (caught instanceof z.ZodError) {
        setError(
          caught.issues[0]?.message ?? "Bitte prüfen Sie Ihre Angaben in den vorherigen Schritten.",
        );
      } else {
        setError(OFFLINE_MESSAGE);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      {progress ? <ProgressHeader current={progress.current} total={progress.total} /> : null}
      <DemoBanner />
      <Title>Geschafft! Mit jeder Vertrauensstufe wird Ihr Profil sichtbarer.</Title>
      <BodyText muted>Bitte prüfen Sie Ihre Angaben – mit „Zurück" können Sie alles ändern.</BodyText>
      <View style={styles.card}>
        <SummaryRow
          label="Rolle"
          value={state.role === "family" ? "Wir suchen Unterstützung" : "Ich möchte Zeit schenken"}
        />
        <SummaryRow label="Anzeigename" value={state.displayName} />
        <SummaryRow label="Geburtsjahr" value={state.birthYear ? String(state.birthYear) : "–"} />
        {state.role === "family" ? (
          <>
            <SummaryRow label="Kinder" value={String(state.childrenCount)} />
            <SummaryRow label="Altersspanne" value={`${state.ageMin}–${state.ageMax} Jahre`} />
            <SummaryRow label="Ihr Wunsch" value={state.careWishes} />
          </>
        ) : (
          <>
            <SummaryRow label="Interessen" value={state.interests.join(", ")} />
            <SummaryRow label="Verfügbarkeit" value={availabilityText || "–"} />
          </>
        )}
        <SummaryRow label="Bezirk" value={state.district ?? "–"} />
        <SummaryRow label="Postleitzahl" value={state.postalCode} />
        {state.bio.trim() ? <SummaryRow label="Kurzvorstellung" value={state.bio.trim()} /> : null}
      </View>
      <FieldError message={error} />
      <PrimaryButton
        label={submitting ? "Wird gespeichert …" : "Profil ansehen und Vertrauensstufe 1 starten"}
        onPress={handleSubmit}
        disabled={submitting}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  row: {
    gap: spacing.xs,
  },
  rowLabel: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: fontSize.bodyLarge,
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
});
