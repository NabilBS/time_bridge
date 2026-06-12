import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { BodyText, PrimaryButton, ScreenContainer } from "@/components/ui";
import { useOnboarding } from "@/lib/onboarding";
import { createSessionFromUrl } from "@/lib/supabase";
import { colors, spacing } from "@/lib/theme";

/** Landet hier über den Magic Link (zeitbruecke://auth/callback). */
export default function AuthCallback() {
  const url = Linking.useURL();
  const router = useRouter();
  const { dispatch, state } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    createSessionFromUrl(url)
      .then(() => {
        if (cancelled) return;
        if (state.step === "welcome" || state.step === "signin") {
          dispatch({ type: "SET_STEP", step: "role" });
        }
        router.replace("/");
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Der Anmelde-Link konnte nicht bestätigt werden. Bitte fordern Sie einen neuen Link an.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
        {error ? (
          <>
            <BodyText>{error}</BodyText>
            <PrimaryButton
              label="Zur Anmeldung"
              onPress={() => router.replace("/onboarding/signin")}
            />
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <BodyText muted>Sie werden angemeldet …</BodyText>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}
