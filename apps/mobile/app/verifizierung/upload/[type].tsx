import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { VERIFICATION_TYPE_LABELS, VerificationType } from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import {
  BodyText,
  FieldError,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  Title,
} from "@/components/ui";
import { colors, fontSize, radius, spacing, touchTarget } from "@/lib/theme";
import {
  ALLOWED_MIME_TYPES,
  submitVerification,
  validatePickedFile,
  VERIFICATION_ERROR_MESSAGES,
  VerificationError,
  type PickedFile,
} from "@/lib/verifications";

const UPLOAD_TYPES: VerificationType[] = ["first_aid_child", "training_course", "background_check"];

function formatSize(bytes: number | null): string {
  if (bytes == null) return "";
  return ` (${(bytes / (1024 * 1024)).toFixed(1)} MB)`;
}

export default function VerificationUpload() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const parsedType = VerificationType.safeParse(params.type);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!parsedType.success || !UPLOAD_TYPES.includes(parsedType.data)) {
    return (
      <ScreenContainer>
        <Title>Hier ist kein Upload vorgesehen</Title>
        <SecondaryButton label="Zurück" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }
  const type = parsedType.data;

  function takeFile(picked: PickedFile) {
    try {
      validatePickedFile(picked);
      setFile(picked);
      setFileError(null);
      setSubmitError(null);
    } catch (caught) {
      setFile(null);
      setFileError(
        caught instanceof VerificationError ? caught.message : VERIFICATION_ERROR_MESSAGES.file_type,
      );
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [...ALLOWED_MIME_TYPES],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return; // Abbruch ist kein Fehler
    const asset = result.assets[0];
    takeFile({
      uri: asset.uri,
      mimeType: asset.mimeType ?? "",
      size: asset.size ?? null,
      name: asset.name,
    });
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setFileError("Ohne Kamera-Zugriff können Sie kein Foto aufnehmen – Sie können stattdessen ein Dokument auswählen.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    takeFile({
      uri: asset.uri,
      mimeType: asset.mimeType ?? "image/jpeg",
      size: asset.fileSize ?? null,
      name: asset.fileName ?? "Foto.jpg",
    });
  }

  async function handleSubmit() {
    if (!file) {
      setFileError("Bitte wählen Sie zuerst ein Dokument aus oder nehmen Sie ein Foto auf.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitVerification(type, file);
      router.replace(`/verifizierung/${type}`);
    } catch (caught) {
      // Die ausgewählte Datei bleibt erhalten – erneutes Senden genügt.
      setSubmitError(
        caught instanceof VerificationError ? caught.message : VERIFICATION_ERROR_MESSAGES.offline,
      );
    } finally {
      setSubmitting(false);
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
      <Title>{VERIFICATION_TYPE_LABELS[type]} einreichen</Title>
      <BodyText muted>
        Erlaubt sind JPG, PNG, HEIC oder PDF, höchstens 10 MB. Sie können das Dokument auch
        einfach abfotografieren.
      </BodyText>
      <SecondaryButton label="Dokument auswählen" onPress={pickDocument} />
      <SecondaryButton label="Foto aufnehmen" onPress={takePhoto} />
      {file ? (
        <View style={styles.fileBox}>
          <Text style={styles.fileName}>
            {file.name}
            {formatSize(file.size)}
          </Text>
        </View>
      ) : null}
      <FieldError message={fileError} />
      <FieldError message={submitError} />
      <View style={{ flex: 1, minHeight: spacing.md }} />
      <PrimaryButton
        label={submitting ? "Wird hochgeladen …" : "Jetzt einreichen"}
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
  fileBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  fileName: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: "600",
  },
});
