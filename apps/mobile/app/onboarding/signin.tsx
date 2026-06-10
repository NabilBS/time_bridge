import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { z } from "zod";

import { DemoBanner } from "@/components/DemoBanner";
import { ProgressHeader } from "@/components/ProgressHeader";
import { BodyText, PrimaryButton, ScreenContainer, TextField, Title } from "@/components/ui";
import { stepProgress, useOnboarding } from "@/lib/onboarding";
import { isDemo, supabase } from "@/lib/supabase";
import { spacing } from "@/lib/theme";

const EmailSchema = z.string().trim().email();

export default function SignIn() {
  const router = useRouter();
  const { state, dispatch } = useOnboarding();
  const [email, setEmail] = useState(state.email);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const progress = stepProgress("signin", state.role);

  async function handleContinue() {
    const parsed = EmailSchema.safeParse(email);
    if (!parsed.success) {
      setError("Diese E-Mail-Adresse scheint ungültig zu sein.");
      return;
    }
    setError(null);
    dispatch({ type: "SET_EMAIL", email: parsed.data });

    if (isDemo || !supabase) {
      // Demo: keine echte Anmeldung, direkt weiter zur Rollenwahl.
      dispatch({ type: "SET_STEP", step: "role" });
      router.push("/onboarding/role");
      return;
    }

    setSending(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: Linking.createURL("auth/callback") },
    });
    setSending(false);

    if (otpError) {
      setError(
        "Keine Verbindung – Ihre Eingaben sind gespeichert, bitte versuchen Sie es gleich erneut.",
      );
      return;
    }
    router.push("/onboarding/check-email");
  }

  return (
    <ScreenContainer>
      {progress ? <ProgressHeader current={progress.current} total={progress.total} /> : null}
      <DemoBanner />
      <Title>Anmelden</Title>
      <BodyText>
        Geben Sie Ihre E-Mail-Adresse ein. Wir schicken Ihnen einen Anmelde-Link – ganz ohne
        Passwort.
      </BodyText>
      <TextField
        label="E-Mail-Adresse"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (error) setError(null);
        }}
        error={error}
        placeholder="ihre.adresse@beispiel.de"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <View style={{ flex: 1, minHeight: spacing.lg }} />
      <PrimaryButton
        label={sending ? "Wird gesendet …" : "Weiter"}
        onPress={handleContinue}
        disabled={sending}
      />
    </ScreenContainer>
  );
}
