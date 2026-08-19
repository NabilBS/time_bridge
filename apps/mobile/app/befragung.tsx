import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { useOnboarding } from "@/lib/onboarding";
import { isDemo, supabase } from "@/lib/supabase";
import {
  markSurveyAsked,
  submitSurveyAnswers,
  SURVEY_OFFLINE_MESSAGE,
  type SurveyAnswer,
} from "@/lib/surveys";
import { colors, fontSize, fontWeight, radius, spacing, touchTarget } from "@/lib/theme";

const SCALE_ANCHORS = ["stimme nicht zu", "", "teils-teils", "", "stimme voll zu"];

function ScoreGrid({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number | null;
  onChange: (score: number) => void;
}) {
  const scores = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  return (
    <View style={styles.scoreGrid}>
      {scores.map((score) => {
        const selected = score === value;
        return (
          <Pressable
            key={score}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${score} von ${max}`}
            onPress={() => onChange(score)}
            style={[styles.scoreField, selected && styles.scoreFieldSelected]}
          >
            <Text style={[styles.scoreLabel, selected && styles.scoreLabelSelected]}>{score}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Survey() {
  const router = useRouter();
  const { state } = useOnboarding();
  const [role, setRole] = useState<"senior" | "family">(state.role ?? "senior");
  const [nps, setNps] = useState<number | null>(null);
  const [roleScore, setRoleScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Auch Überspringen zählt als „gefragt" – 60 Tage Ruhe.
    markSurveyAsked();
    if (isDemo || !supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user.id;
      if (!userId || !supabase) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.role === "family" || profile?.role === "senior") setRole(profile.role);
    });
  }, []);

  const roleQuestion =
    role === "senior"
      ? "Fühlen Sie sich durch Zeitbrücke weniger allein?"
      : "Entlastet Zeitbrücke Ihren Familienalltag?";
  const roleKind = role === "senior" ? ("wellbeing_senior" as const) : ("relief_family" as const);

  async function handleSubmit() {
    const answers: SurveyAnswer[] = [];
    const trimmed = comment.trim();
    if (nps != null) {
      answers.push({ kind: "nps", score: nps, comment: trimmed ? trimmed : null });
    }
    if (roleScore != null) {
      answers.push({
        kind: roleKind,
        score: roleScore,
        comment: nps == null && trimmed ? trimmed : null,
      });
    }
    if (answers.length === 0) {
      setError("Bitte beantworten Sie mindestens eine Frage – oder überspringen Sie die Befragung.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitSurveyAnswers(answers);
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SURVEY_OFFLINE_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <DemoBanner />
      <Title>Einen Moment für Zeitbrücke?</Title>
      <BodyText muted>
        Ihre Antwort hilft uns zu zeigen, dass Zeitbrücke wirkt – freiwillig und jederzeit
        überspringbar.
      </BodyText>

      <Text style={styles.question}>Würden Sie Zeitbrücke weiterempfehlen?</Text>
      <BodyText muted>0 = ganz sicher nicht · 10 = ganz sicher</BodyText>
      <ScoreGrid min={0} max={10} value={nps} onChange={setNps} />

      <Text style={styles.question}>{roleQuestion}</Text>
      <ScoreGrid min={1} max={5} value={roleScore} onChange={setRoleScore} />
      <View style={styles.anchorRow}>
        <Text style={styles.anchor}>{SCALE_ANCHORS[0]}</Text>
        <Text style={styles.anchor}>{SCALE_ANCHORS[4]}</Text>
      </View>

      <TextField
        label="Möchten Sie uns etwas mitgeben? (optional)"
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={600}
        placeholder="Ihre Anmerkung …"
      />

      <FieldError message={error} />
      <PrimaryButton
        label={submitting ? "Wird gesendet …" : "Antwort senden"}
        onPress={handleSubmit}
        disabled={submitting}
      />
      <SecondaryButton label="Überspringen" onPress={() => router.back()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  question: {
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  scoreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  scoreField: {
    minWidth: touchTarget.buttonHeight,
    minHeight: touchTarget.buttonHeight,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreFieldSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  scoreLabel: {
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  scoreLabelSelected: {
    color: colors.onPrimary,
  },
  anchorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  anchor: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
});
