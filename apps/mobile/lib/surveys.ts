import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SurveyKind } from "@zeitbruecke/shared";

import { countCompletedMeetings } from "@/lib/meetings";
import { isDemo, supabase } from "@/lib/supabase";

export const SURVEY_OFFLINE_MESSAGE =
  "Keine Verbindung – Ihre Eingaben sind gespeichert, bitte versuchen Sie es gleich erneut.";
export const SURVEY_DUPLICATE_MESSAGE =
  "Sie haben uns kürzlich schon geantwortet – vielen Dank!";

const LAST_ASKED_KEY = "zeitbruecke.survey.lastAskedAt.v1";
const DEMO_ANSWERS_KEY = "zeitbruecke.survey.demoAnswers.v1";

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Befragung erst nach dem zweiten abgeschlossenen Treffen (nicht nach dem
 * ersten – das wäre Euphorie oder Frust des Einzelfalls), danach frühestens
 * alle 60 Tage. Lokal gedrosselt; die DB-Sperre (Unique je 60-Tage-Bucket)
 * ist das Sicherheitsnetz.
 */
export async function shouldShowSurvey(): Promise<boolean> {
  const completed = await countCompletedMeetings();
  if (completed < 2) return false;
  const lastAsked = await AsyncStorage.getItem(LAST_ASKED_KEY).catch(() => null);
  if (!lastAsked) return true;
  return Date.now() - new Date(lastAsked).getTime() > SIXTY_DAYS_MS;
}

/** Beim Anzeigen des Dialogs aufrufen – zählt auch bei „Überspringen". */
export async function markSurveyAsked(): Promise<void> {
  await AsyncStorage.setItem(LAST_ASKED_KEY, new Date().toISOString()).catch(() => undefined);
}

export interface SurveyAnswer {
  kind: SurveyKind;
  score: number;
  comment: string | null;
}

export async function submitSurveyAnswers(answers: SurveyAnswer[]): Promise<void> {
  if (answers.length === 0) return;

  if (isDemo || !supabase) {
    const raw = await AsyncStorage.getItem(DEMO_ANSWERS_KEY).catch(() => null);
    const stored = raw ? (JSON.parse(raw) as SurveyAnswer[]) : [];
    stored.push(...answers);
    await AsyncStorage.setItem(DEMO_ANSWERS_KEY, JSON.stringify(stored)).catch(() => undefined);
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error(SURVEY_OFFLINE_MESSAGE);

  const { error } = await supabase.from("surveys").insert(
    answers.map((answer) => ({
      profile_id: userId,
      kind: answer.kind,
      score: answer.score,
      comment: answer.comment,
    })),
  );
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error(SURVEY_DUPLICATE_MESSAGE);
    }
    throw new Error(SURVEY_OFFLINE_MESSAGE);
  }
}
