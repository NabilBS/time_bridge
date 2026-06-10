import { DemoBanner } from "@/components/DemoBanner";
import { BodyText, ScreenContainer, Title } from "@/components/ui";

export default function Home() {
  return (
    <ScreenContainer>
      <DemoBanner />
      <Title>Willkommen bei Zeitbrücke</Title>
      <BodyText>
        Schön, dass Sie dabei sind! Anfragen und Nachrichten finden Sie bald hier – wir bauen
        Zeitbrücke Schritt für Schritt aus.
      </BodyText>
      <BodyText muted>
        Tipp: Vervollständigen Sie Ihre Vertrauensstufe im Profil, damit Ihr Profil sichtbarer
        wird.
      </BodyText>
    </ScreenContainer>
  );
}
