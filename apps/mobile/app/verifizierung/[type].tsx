import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  VERIFICATION_TYPE_LABELS,
  VerificationType,
  type VerificationStatus,
} from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import {
  BodyText,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  Title,
} from "@/components/ui";
import {
  IDENT_OFFLINE_MESSAGE,
  loadLatestIdentSession,
  startIdentSession,
  type IdentSessionInfo,
} from "@/lib/ident";
import { isDemo } from "@/lib/supabase";
import { colors, fontSize, radius, spacing, touchTarget } from "@/lib/theme";
import {
  latestByType,
  loadVerifications,
  simulateDemoApproval,
  VERIFICATION_ERROR_MESSAGES,
  VerificationError,
  type VerificationEntry,
} from "@/lib/verifications";

const SUPPORT_EMAIL = "support@zeitbruecke.de";

const STATUS_TEXTS: Record<VerificationStatus, string> = {
  submitted: "Wird geprüft – Sie hören von uns.",
  approved: "Bestätigt – diese Stufe ist in Ihrem Profil sichtbar.",
  rejected: "Das hat leider nicht geklappt – bitte erneut einreichen.",
  expired: "Bitte erneuern – Ihr Nachweis ist abgelaufen.",
};

function StatusBox({ entry }: { entry: VerificationEntry | undefined }) {
  if (!entry) return null;
  return (
    <View style={[styles.statusBox, entry.status === "approved" && styles.statusBoxApproved]}>
      <Text style={styles.statusText}>{STATUS_TEXTS[entry.status]}</Text>
      {entry.status === "approved" && entry.valid_until ? (
        <Text style={styles.statusMeta}>Gültig bis {entry.valid_until}</Text>
      ) : null}
    </View>
  );
}

export default function VerificationDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const parsedType = VerificationType.safeParse(params.type);
  const [entry, setEntry] = useState<VerificationEntry | undefined>(undefined);
  const [identSession, setIdentSession] = useState<IdentSessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!parsedType.success) return;
    try {
      const entries = await loadVerifications();
      setEntry(latestByType(entries)[parsedType.data]);
      if (parsedType.data === "video_ident") {
        setIdentSession(await loadLatestIdentSession().catch(() => null));
      }
      setLoadError(null);
    } catch (caught) {
      setLoadError(
        caught instanceof VerificationError
          ? caught.message
          : VERIFICATION_ERROR_MESSAGES.offline,
      );
    }
  }, [parsedType.success ? parsedType.data : null]);

  async function handleStartIdent() {
    setBusy(true);
    setActionError(null);
    try {
      const redirectUrl = await startIdentSession();
      if (redirectUrl.startsWith("zeitbruecke://")) {
        // Demo: kein externer Anbieter – direkt zum Callback.
        router.push("/ident/callback");
      } else {
        await WebBrowser.openAuthSessionAsync(redirectUrl, "zeitbruecke://ident/callback");
      }
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : IDENT_OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    reload();
  }, [reload]);

  if (!parsedType.success) {
    return (
      <ScreenContainer>
        <Title>Unbekannte Vertrauensstufe</Title>
        <SecondaryButton label="Zurück zum Profil" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  const type = parsedType.data;
  const label = VERIFICATION_TYPE_LABELS[type];
  const status = entry?.status;
  const canSubmit = !status || status === "rejected" || status === "expired";
  const bookingUrl = process.env.EXPO_PUBLIC_IDENT_BOOKING_URL;

  async function handleDemoAction(action: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await reload();
    } catch (caught) {
      setActionError(
        caught instanceof VerificationError
          ? caught.message
          : VERIFICATION_ERROR_MESSAGES.offline,
      );
    } finally {
      setBusy(false);
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
      <Title>{label}</Title>
      {loadError ? <BodyText>{loadError}</BodyText> : null}
      <StatusBox entry={entry} />

      {type === "background_check" ? (
        <>
          <BodyText>
            Das erweiterte Führungszeugnis zeigt, dass Ihrer Arbeit mit Kindern nichts
            entgegensteht. Sie beantragen es im Bürgeramt oder online beim Bundesamt für Justiz
            – für ehrenamtliche Tätigkeiten ist es in der Regel gebührenfrei.
          </BodyText>
          <BodyText>
            Bitte reichen Sie ein Dokument ein, das bei Einreichung nicht älter als 3 Monate
            ist.
          </BodyText>
          <View style={styles.privacyNote}>
            <BodyText>
              Wir prüfen Ihr Dokument und löschen die Datei danach. Gespeichert bleibt nur:
              geprüft, gültig bis.
            </BodyText>
          </View>
        </>
      ) : null}

      {type === "first_aid_child" ? (
        <BodyText>
          Reichen Sie Ihre Teilnahmebescheinigung eines Erste-Hilfe-am-Kind-Kurses ein – als
          Foto oder PDF.
        </BodyText>
      ) : null}

      {type === "training_course" ? (
        <BodyText>
          Reichen Sie Ihren Schulungsnachweis ein, zum Beispiel eine Bescheinigung der
          Volkshochschule – als Foto oder PDF.
        </BodyText>
      ) : null}

      {type === "video_ident" ? (
        <>
          <BodyText>
            Sie können Ihre Identität direkt online bestätigen: Ein geprüfter Anbieter sieht
            dabei kurz Ihren Ausweis und Ihr Gesicht über die Kamera dieses Geräts.
          </BodyText>
          <View style={styles.privacyNote}>
            <BodyText>
              Zeitbrücke speichert davon nur das Ergebnis: geprüft ja oder nein. Keine
              Ausweisdaten, keine Bilder.
            </BodyText>
          </View>
          {identSession?.status === "created" ? (
            <BodyText>Identifizierung läuft – das Ergebnis kommt in wenigen Minuten.</BodyText>
          ) : null}
          {identSession?.status === "failed" ? (
            <BodyText>
              Identifizierung nicht abgeschlossen – Sie können es erneut versuchen oder einen
              Video-Termin buchen.
            </BodyText>
          ) : null}
        </>
      ) : null}

      {type === "partner_reference" ? (
        <BodyText>
          Wird von Ihrem Partner-Ort bestätigt – zum Beispiel Ihrer Kirchengemeinde, Ihrem
          Verein oder Ihrer Begegnungsstätte. Sie müssen hier nichts einreichen.
        </BodyText>
      ) : null}

      {actionError ? <BodyText>{actionError}</BodyText> : null}

      {(type === "first_aid_child" || type === "training_course" || type === "background_check") &&
      canSubmit ? (
        <PrimaryButton
          label={status ? "Erneut einreichen" : "Dokument einreichen"}
          onPress={() => router.push(`/verifizierung/upload/${type}`)}
        />
      ) : null}

      {type === "video_ident" && canSubmit ? (
        <>
          {identSession?.status === "created" ? (
            <PrimaryButton label="Status aktualisieren" onPress={() => reload()} disabled={busy} />
          ) : (
            <PrimaryButton
              label={busy ? "Wird gestartet …" : "Jetzt online identifizieren (ca. 5 Minuten)"}
              onPress={handleStartIdent}
              disabled={busy}
            />
          )}
          {/* Der persönliche Weg bleibt gleichberechtigt – Barrierefreiheit,
              keine Notlösung. */}
          {bookingUrl ? (
            <SecondaryButton
              label="Lieber im persönlichen Video-Gespräch? Termin vereinbaren"
              onPress={() => {
                Linking.openURL(bookingUrl).catch(() =>
                  setActionError("Der Buchungslink konnte nicht geöffnet werden."),
                );
              }}
            />
          ) : (
            <BodyText muted>
              Lieber im persönlichen Video-Gespräch? Die Terminbuchung wird gerade eingerichtet –
              bitte schauen Sie bald wieder vorbei.
            </BodyText>
          )}
        </>
      ) : null}

      {status === "rejected" ? (
        <SecondaryButton
          label="Support kontaktieren"
          onPress={() => {
            Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() =>
              setActionError(`Bitte schreiben Sie uns an ${SUPPORT_EMAIL}.`),
            );
          }}
        />
      ) : null}

      {isDemo && status === "submitted" ? (
        <SecondaryButton
          label="Prüfung simulieren (Demo)"
          onPress={() => handleDemoAction(() => simulateDemoApproval(type))}
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
    fontWeight: "600",
  },
  statusBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statusBoxApproved: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  statusText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  statusMeta: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  privacyNote: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
