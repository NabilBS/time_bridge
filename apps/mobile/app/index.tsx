import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { BodyText, PrimaryButton, ScreenContainer } from "@/components/ui";
import { stepRoute, useOnboarding } from "@/lib/onboarding";
import { isDemo, supabase } from "@/lib/supabase";
import { colors, spacing } from "@/lib/theme";

const OFFLINE_MESSAGE =
  "Keine Verbindung – Ihre Eingaben sind gespeichert, bitte versuchen Sie es gleich erneut.";

/**
 * Routing beim App-Start:
 * 1. keine Session → /onboarding/welcome
 * 2. Session ohne Profil → Onboarding am gespeicherten Schritt fortsetzen (ab Schritt 2)
 * 3. Session + Profil → /(tabs)
 */
export default function Index() {
  const router = useRouter();
  const { state, hydrated } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setError(null);

    async function route() {
      if (isDemo || !supabase) {
        if (state.demoCompletedAt) {
          router.replace("/(tabs)");
        } else if (state.step !== "welcome") {
          router.replace(stepRoute(state.step));
        } else {
          router.replace("/onboarding/welcome");
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!data.session) {
        router.replace("/onboarding/welcome");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (cancelled) return;

      if (profileError) {
        setError(OFFLINE_MESSAGE);
        return;
      }

      if (profile) {
        router.replace("/(tabs)");
        return;
      }

      // Angemeldet, aber noch kein Profil: ab Schritt 2 (Rollenwahl) fortsetzen.
      const resumeStep =
        state.step === "welcome" || state.step === "signin" ? "role" : state.step;
      router.replace(stepRoute(resumeStep));
    }

    route().catch(() => {
      if (!cancelled) setError(OFFLINE_MESSAGE);
    });

    return () => {
      cancelled = true;
    };
    // state wird bewusst nur beim (Re-)Start gelesen, nicht bei jeder Änderung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, attempt]);

  if (error) {
    return (
      <ScreenContainer scroll={false}>
        <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
          <BodyText>{error}</BodyText>
          <PrimaryButton label="Erneut versuchen" onPress={() => setAttempt((n) => n + 1)} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </ScreenContainer>
  );
}
