import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { BERLIN_DISTRICTS, BIO_MAX_LENGTH, PostalCodeSchema } from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import { ProgressHeader } from "@/components/ProgressHeader";
import {
  BodyText,
  Chip,
  FieldError,
  PrimaryButton,
  ScreenContainer,
  TextField,
  Title,
} from "@/components/ui";
import { stepProgress, useOnboarding } from "@/lib/onboarding";
import { spacing } from "@/lib/theme";

export default function District() {
  const router = useRouter();
  const { state, dispatch } = useOnboarding();
  const [district, setDistrict] = useState<string | null>(state.district);
  const [postalCode, setPostalCode] = useState(state.postalCode);
  const [bio, setBio] = useState(state.bio);
  const [districtError, setDistrictError] = useState<string | null>(null);
  const [postalCodeError, setPostalCodeError] = useState<string | null>(null);
  const progress = stepProgress("district", state.role);

  function handleContinue() {
    let valid = true;
    if (!district) {
      setDistrictError("Bitte wählen Sie Ihren Bezirk.");
      valid = false;
    }
    const parsedPostalCode = PostalCodeSchema.safeParse(postalCode.trim());
    if (!parsedPostalCode.success) {
      setPostalCodeError("Bitte geben Sie eine gültige Postleitzahl ein (5 Ziffern).");
      valid = false;
    }
    if (!valid || !district || !parsedPostalCode.success) return;

    dispatch({
      type: "SET_KIEZ",
      district,
      postalCode: parsedPostalCode.data,
      bio: bio.trim(),
    });
    router.push("/onboarding/summary");
  }

  return (
    <ScreenContainer>
      {progress ? <ProgressHeader current={progress.current} total={progress.total} /> : null}
      <DemoBanner />
      <Title>Ihr Kiez</Title>
      <BodyText muted>In welchem Bezirk sind Sie zu Hause?</BodyText>
      <View style={styles.districtWrap}>
        {BERLIN_DISTRICTS.map((entry) => (
          <Chip
            key={entry}
            label={entry}
            selected={district === entry}
            onPress={() => {
              setDistrict(entry);
              if (districtError) setDistrictError(null);
            }}
          />
        ))}
      </View>
      <FieldError message={districtError} />
      <TextField
        label="Postleitzahl"
        value={postalCode}
        onChangeText={(text) => {
          setPostalCode(text);
          if (postalCodeError) setPostalCodeError(null);
        }}
        error={postalCodeError}
        keyboardType="number-pad"
        maxLength={5}
        placeholder="z. B. 10115"
      />
      <TextField
        label="Kurzvorstellung (optional)"
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={BIO_MAX_LENGTH}
        placeholder="Erzählen Sie in zwei, drei Sätzen etwas über sich …"
      />
      <PrimaryButton label="Weiter" onPress={handleContinue} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  districtWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
