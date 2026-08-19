import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { DemoBanner } from "@/components/DemoBanner";
import {
  BodyText,
  FieldError,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  Title,
} from "@/components/ui";
import { useOnboarding } from "@/lib/onboarding";
import {
  loadPhotoState,
  PHOTO_OFFLINE_MESSAGE,
  simulateDemoPhotoApproval,
  submitPhoto,
  type PhotoState,
} from "@/lib/photos";
import { isDemo } from "@/lib/supabase";
import {
  avatarSize,
  colors,
  fontSize,
  fontWeight,
  radius,
  spacing,
  touchTarget,
} from "@/lib/theme";

export default function ProfilePhoto() {
  const router = useRouter();
  const { state: onboardingState } = useOnboarding();
  const [photo, setPhoto] = useState<PhotoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setPhoto(await loadPhotoState());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : PHOTO_OFFLINE_MESSAGE);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handlePicked(uri: string | undefined) {
    if (!uri) return;
    setBusy(true);
    setError(null);
    try {
      await submitPhoto(uri);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : PHOTO_OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled) return;
    await handlePicked(result.assets[0]?.uri);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError(
        "Ohne Kamera-Zugriff können Sie kein Foto aufnehmen – Sie können stattdessen ein Bild aus Ihren Fotos wählen.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled) return;
    await handlePicked(result.assets[0]?.uri);
  }

  const status = photo?.submissionStatus ?? null;
  const canSubmit = status !== "submitted";
  const displayName = onboardingState.displayName || "Sie";

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
      <Title>Ihr Profilfoto</Title>

      <View style={styles.avatarRow}>
        <Avatar
          name={displayName}
          photoPath={photo?.pendingUri ?? photo?.photoPath}
          size={avatarSize.xl}
          pending={status === "submitted"}
        />
        {status === "submitted" ? (
          <BodyText muted>Wird geprüft – Sie hören von uns.</BodyText>
        ) : null}
      </View>

      {status === "rejected" && photo?.reviewNote ? (
        <View style={styles.rejectBox}>
          <BodyText>
            Ihr Foto konnte nicht freigegeben werden: {photo.reviewNote}. Sie können gern ein
            neues Foto einreichen.
          </BodyText>
        </View>
      ) : null}

      <View style={styles.rulesBox}>
        <BodyText>
          Bitte ein aktuelles Foto, auf dem nur Sie zu sehen sind. Keine Kinder, keine anderen
          Personen, keine Gruppenbilder.
        </BodyText>
      </View>
      <BodyText muted>
        Ihr Foto wird vor der Veröffentlichung von unserem Team geprüft. Beim Hochladen werden
        alle Metadaten (z. B. der Aufnahmeort) automatisch entfernt.
      </BodyText>

      <FieldError message={error} />

      {canSubmit ? (
        <>
          <PrimaryButton
            label={busy ? "Wird hochgeladen …" : "Foto aufnehmen"}
            onPress={takePhoto}
            disabled={busy}
          />
          <SecondaryButton label="Aus meinen Fotos wählen" onPress={pickFromLibrary} />
        </>
      ) : null}

      {isDemo && status === "submitted" ? (
        <SecondaryButton
          label="Prüfung simulieren (Demo)"
          onPress={async () => {
            await simulateDemoPhotoApproval();
            await reload();
          }}
        />
      ) : null}
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
    fontWeight: fontWeight.semibold,
  },
  avatarRow: {
    alignItems: "center",
    gap: spacing.sm,
  },
  rulesBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rejectBox: {
    backgroundColor: colors.errorSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
