import { useRouter } from "expo-router";
import type { Role } from "@zeitbruecke/shared";

import { DemoBanner } from "@/components/DemoBanner";
import { ProgressHeader } from "@/components/ProgressHeader";
import { BodyText, ScreenContainer, SelectCard, Title } from "@/components/ui";
import { stepProgress, useOnboarding } from "@/lib/onboarding";

export default function RoleChoice() {
  const router = useRouter();
  const { state, dispatch } = useOnboarding();
  const progress = stepProgress("role", state.role);

  function choose(role: Role) {
    dispatch({ type: "SET_ROLE", role });
    router.push("/onboarding/basics");
  }

  return (
    <ScreenContainer>
      {progress ? <ProgressHeader current={progress.current} total={progress.total} /> : null}
      <DemoBanner />
      <Title>Wie möchten Sie Zeitbrücke nutzen?</Title>
      <BodyText muted>Bitte wählen Sie aus, was auf Sie zutrifft.</BodyText>
      <SelectCard
        title="Ich möchte Zeit schenken"
        subtitle="Sie sind gern für Kinder und Familien in Ihrem Kiez da – mit Ihrer Erfahrung und Ihrer Zeit."
        selected={state.role === "senior"}
        onPress={() => choose("senior")}
      />
      <SelectCard
        title="Wir suchen Unterstützung"
        subtitle="Ihre Familie wünscht sich eine vertraute Person aus der Nachbarschaft."
        selected={state.role === "family"}
        onPress={() => choose("family")}
      />
    </ScreenContainer>
  );
}
