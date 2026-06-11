import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RPC_DELETE_ACCOUNT } from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import {
  BodyText,
  FieldError,
  PrimaryButton,
  ScreenContainer,
  TextField,
  Title,
} from "@/components/ui";
import { deletePushToken } from "@/lib/notifications";
import { useOnboarding } from "@/lib/onboarding";
import { isDemo, supabase } from "@/lib/supabase";
import { colors, fontSize, radius, spacing, touchTarget } from "@/lib/theme";

const CONFIRM_WORD = "LÖSCHEN";

export default function DeleteAccount() {
  const router = useRouter();
  const { clear } = useOnboarding();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const confirmed = confirmation.trim() === CONFIRM_WORD;

  async function handleDelete() {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      if (!isDemo && supabase) {
        const { error: rpcError } = await supabase.rpc(RPC_DELETE_ACCOUNT);
        if (rpcError) {
          setError(
            "Ihr Konto konnte gerade nicht gelöscht werden. Es ist nichts verloren gegangen – bitte versuchen Sie es in ein paar Minuten erneut.",
          );
          return;
        }
        await supabase.auth.signOut().catch(() => undefined);
      }
      // Demo: nur der Flow wird simuliert – lokalen Zustand räumen.
      await deletePushToken().catch(() => undefined);
      await AsyncStorage.clear().catch(() => undefined);
      await clear();
      router.dismissAll?.();
      router.replace("/onboarding/welcome");
    } finally {
      setDeleting(false);
    }
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
      <Title>Konto löschen</Title>
      <BodyText>
        Ihr Profil, Ihre Chats und Ihre Nachweise werden dauerhaft gelöscht. Das lässt sich
        nicht rückgängig machen.
      </BodyText>
      <View style={styles.warningBox}>
        <BodyText>
          Wenn Sie sicher sind, tippen Sie das Wort {CONFIRM_WORD} in das Feld und bestätigen
          Sie.
        </BodyText>
      </View>
      <TextField
        label={`Zur Bestätigung „${CONFIRM_WORD}" eintippen`}
        value={confirmation}
        onChangeText={setConfirmation}
        autoCapitalize="characters"
        placeholder={CONFIRM_WORD}
      />
      <FieldError message={error} />
      <PrimaryButton
        label={deleting ? "Wird gelöscht …" : "Konto endgültig löschen"}
        onPress={handleDelete}
        disabled={!confirmed || deleting}
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
  warningBox: {
    backgroundColor: colors.errorSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
