import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
import {
  ALREADY_REVIEWED_MESSAGE,
  OFFLINE_MESSAGE,
  submitReview,
} from "@/lib/meetings";
import { colors, fontSize, spacing, touchTarget } from "@/lib/theme";

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (stars: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          accessibilityRole="button"
          accessibilityLabel={`${star} von 5 Sternen`}
          onPress={() => onChange(star)}
          style={styles.star}
        >
          <Text style={[styles.starGlyph, star <= value && styles.starGlyphActive]}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ReviewMeeting() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meetingId?: string; reviewedId?: string }>();
  const meetingId = typeof params.meetingId === "string" ? params.meetingId : null;
  const reviewedId = typeof params.reviewedId === "string" ? params.reviewedId : undefined;

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!meetingId) return;
    if (stars < 1) {
      setError("Bitte vergeben Sie mindestens einen Stern.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitReview(meetingId, stars, comment, reviewedId);
      router.back();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : OFFLINE_MESSAGE;
      setError(message);
      // Bereits bewertet: zurück, der Dialog erscheint nicht erneut.
      if (message === ALREADY_REVIEWED_MESSAGE) {
        setTimeout(() => router.back(), 1200);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!meetingId) {
    return (
      <ScreenContainer>
        <Title>Bewertung nicht möglich</Title>
        <SecondaryButton label="Zurück" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <DemoBanner />
      <Title>Wie war Ihr Treffen?</Title>
      <BodyText muted>
        Ihre Bewertung hilft anderen, Vertrauen zu fassen. Sie können einen kurzen Kommentar
        ergänzen – er ist nur für Ihr Gegenüber sichtbar.
      </BodyText>
      <StarRating value={stars} onChange={setStars} />
      <TextField
        label="Kommentar (optional)"
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={600}
        placeholder="Was möchten Sie mitgeben?"
      />
      <FieldError message={error} />
      <PrimaryButton
        label={submitting ? "Wird gespeichert …" : "Bewertung abgeben"}
        onPress={handleSubmit}
        disabled={submitting}
      />
      <SecondaryButton label="Später" onPress={() => router.back()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  starRow: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
  },
  star: {
    minWidth: touchTarget.minHeight,
    minHeight: touchTarget.minHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  starGlyph: {
    fontSize: 44,
    color: colors.border,
  },
  starGlyphActive: {
    color: "#C9A227",
  },
});
