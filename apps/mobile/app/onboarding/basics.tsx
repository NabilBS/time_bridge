import { useRouter } from "expo-router";
import { useState } from "react";
import { BIRTH_YEAR_MAX, BIRTH_YEAR_MIN } from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import { ProgressHeader } from "@/components/ProgressHeader";
import { YearPicker } from "@/components/YearPicker";
import { BodyText, PrimaryButton, ScreenContainer, TextField, Title } from "@/components/ui";
import { stepProgress, useOnboarding } from "@/lib/onboarding";

export default function Basics() {
  const router = useRouter();
  const { state, dispatch } = useOnboarding();
  const [displayName, setDisplayName] = useState(state.displayName);
  const [birthYear, setBirthYear] = useState<number | null>(state.birthYear);
  const [nameError, setNameError] = useState<string | null>(null);
  const [yearError, setYearError] = useState<string | null>(null);
  const progress = stepProgress("basics", state.role);

  function handleContinue() {
    const trimmed = displayName.trim();
    let valid = true;

    if (trimmed.length < 2) {
      setNameError("Bitte geben Sie Ihren Anzeigenamen ein (mindestens 2 Zeichen).");
      valid = false;
    } else if (trimmed.length > 60) {
      setNameError("Der Anzeigename darf höchstens 60 Zeichen lang sein.");
      valid = false;
    }
    if (birthYear == null) {
      setYearError("Bitte wählen Sie Ihr Geburtsjahr.");
      valid = false;
    }
    if (!valid || birthYear == null) return;

    dispatch({ type: "SET_BASICS", displayName: trimmed, birthYear });
    router.push(state.role === "family" ? "/onboarding/children" : "/onboarding/interests");
  }

  return (
    <ScreenContainer>
      {progress ? <ProgressHeader current={progress.current} total={progress.total} /> : null}
      <DemoBanner />
      <Title>Über Sie</Title>
      <BodyText muted>
        Wir empfehlen Vorname und Initial, zum Beispiel „Helga R." – Ihr voller Name bleibt
        privat.
      </BodyText>
      <TextField
        label="Anzeigename"
        value={displayName}
        onChangeText={(text) => {
          setDisplayName(text);
          if (nameError) setNameError(null);
        }}
        error={nameError}
        placeholder="z. B. Helga R."
        autoCapitalize="words"
      />
      <YearPicker
        label="Geburtsjahr"
        minYear={BIRTH_YEAR_MIN}
        maxYear={BIRTH_YEAR_MAX}
        value={birthYear}
        onChange={(year) => {
          setBirthYear(year);
          if (yearError) setYearError(null);
        }}
        error={yearError}
      />
      <PrimaryButton label="Weiter" onPress={handleContinue} />
    </ScreenContainer>
  );
}
