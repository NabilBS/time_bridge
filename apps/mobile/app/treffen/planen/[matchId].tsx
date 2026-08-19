import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { PARTNER_KIND_LABELS } from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import {
  BodyText,
  FieldError,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  TextField,
  Title,
} from "@/components/ui";
import { formatDateTime } from "@/lib/datetime";
import { loadMatchHeader, loadProfileDetail } from "@/lib/matching";
import {
  createMeeting,
  isFirstMeeting,
  loadPartnerLocations,
  OFFLINE_MESSAGE,
  type PartnerLocationItem,
} from "@/lib/meetings";
import { isDemo, supabase } from "@/lib/supabase";
import { colors, fontSize, fontWeight, radius, spacing, touchTarget } from "@/lib/theme";

function defaultDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(15, 0, 0, 0);
  return date;
}

export default function PlanMeeting() {
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId?: string }>();
  const matchId = typeof params.matchId === "string" ? params.matchId : null;

  const [first, setFirst] = useState(true);
  const [locations, setLocations] = useState<PartnerLocationItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [useFreeText, setUseFreeText] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [when, setWhen] = useState<Date>(defaultDate());
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const firstFlag = await isFirstMeeting(matchId);
      setFirst(firstFlag);

      const districts: string[] = [];
      if (!isDemo && supabase) {
        const header = await loadMatchHeader(matchId);
        const { data } = await supabase
          .from("profiles")
          .select("district")
          .eq("id", header.selfId)
          .maybeSingle();
        if (data?.district) districts.push(data.district as string);
        if (header.partnerId) {
          const partner = await loadProfileDetail(header.partnerId);
          if (partner.profile?.district) districts.push(partner.profile.district);
        }
      }
      setLocations(await loadPartnerLocations(districts));
      setLoadError(null);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : OFFLINE_MESSAGE);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  function onPickerChange(event: DateTimePickerEvent, value?: Date) {
    if (Platform.OS === "android") setPicker(null);
    if (event.type === "dismissed" || !value) return;
    setWhen((current) => {
      const next = new Date(current);
      if (picker === "date") {
        next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
      } else {
        next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      }
      return next;
    });
    if (Platform.OS === "ios") setPicker(null);
  }

  async function handleConfirm() {
    if (!matchId) return;
    if (first && !selectedLocation) {
      setError("Bitte wählen Sie für das erste Treffen einen Partner-Ort.");
      return;
    }
    if (!first && !selectedLocation && useFreeText && !freeText.trim()) {
      setError("Bitte geben Sie an, wo Sie sich treffen möchten.");
      return;
    }
    if (when.getTime() <= Date.now()) {
      setError("Bitte wählen Sie einen Zeitpunkt in der Zukunft.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const locationId = useFreeText ? null : selectedLocation;
      await createMeeting(
        matchId,
        locationId,
        when.toISOString(),
        useFreeText ? freeText : undefined,
      );
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : OFFLINE_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  if (!matchId) {
    return (
      <ScreenContainer>
        <Title>Treffen konnte nicht geöffnet werden</Title>
        <SecondaryButton label="Zurück" onPress={() => router.back()} />
      </ScreenContainer>
    );
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
      <Title>Treffen planen</Title>

      {first ? (
        <View style={styles.note}>
          <BodyText>
            Zur Sicherheit aller findet das erste Treffen an einem geprüften Partner-Ort statt.
          </BodyText>
        </View>
      ) : (
        <BodyText muted>
          Sie kennen sich schon – wählen Sie einen Partner-Ort oder geben Sie einen eigenen Ort
          an.
        </BodyText>
      )}

      {loadError ? <BodyText>{loadError}</BodyText> : null}

      <Text style={styles.sectionTitle}>Ort</Text>
      {locations.length === 0 && !useFreeText ? (
        <BodyText muted>
          In Ihren Bezirken ist gerade kein Partner-Ort hinterlegt – bitte versuchen Sie es
          später erneut.
        </BodyText>
      ) : null}
      {locations.map((location) => {
        const selected = selectedLocation === location.id && !useFreeText;
        return (
          <Pressable
            key={location.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              setSelectedLocation(location.id);
              setUseFreeText(false);
              if (error) setError(null);
            }}
            style={[styles.locationCard, selected && styles.locationCardSelected]}
          >
            <Text style={styles.locationName}>{location.name}</Text>
            <Text style={styles.locationMeta}>
              {PARTNER_KIND_LABELS[location.kind]}
              {location.street ? ` · ${location.street}` : ""}
              {location.district ? ` · ${location.district}` : ""}
            </Text>
          </Pressable>
        );
      })}

      {!first ? (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: useFreeText }}
          onPress={() => {
            setUseFreeText(true);
            setSelectedLocation(null);
            if (error) setError(null);
          }}
          style={[styles.locationCard, useFreeText && styles.locationCardSelected]}
        >
          <Text style={styles.locationName}>Eigenen Ort angeben</Text>
          <Text style={styles.locationMeta}>z. B. „Café am Park" oder Ihre Adresse</Text>
        </Pressable>
      ) : null}

      {useFreeText ? (
        <TextField
          label="Wo möchten Sie sich treffen?"
          value={freeText}
          onChangeText={setFreeText}
          placeholder="Ort eingeben"
          maxLength={120}
        />
      ) : null}

      <Text style={styles.sectionTitle}>Wann</Text>
      <View style={styles.whenBox}>
        <Text style={styles.whenValue}>{formatDateTime(when.toISOString())}</Text>
      </View>
      <View style={styles.whenButtons}>
        <View style={styles.whenButton}>
          <SecondaryButton label="Datum wählen" onPress={() => setPicker("date")} />
        </View>
        <View style={styles.whenButton}>
          <SecondaryButton label="Uhrzeit wählen" onPress={() => setPicker("time")} />
        </View>
      </View>

      {picker ? (
        <DateTimePicker
          value={when}
          mode={picker}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={picker === "date" ? new Date() : undefined}
          onChange={onPickerChange}
        />
      ) : null}

      <FieldError message={error} />
      <PrimaryButton
        label={saving ? "Wird gespeichert …" : "Treffen vorschlagen"}
        onPress={handleConfirm}
        disabled={saving}
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
    fontWeight: fontWeight.semibold,
  },
  note: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  locationCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: touchTarget.minHeight,
  },
  locationCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  locationName: {
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  locationMeta: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  whenBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  whenValue: {
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  whenButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  whenButton: {
    flex: 1,
  },
});
