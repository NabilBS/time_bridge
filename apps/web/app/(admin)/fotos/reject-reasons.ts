/** Schnellauswahl-Begründungen für die Foto-Ablehnung. */
export const REJECT_REASONS = {
  child_in_photo: "Kind im Bild",
  other_person: "Andere Person erkennbar",
  not_recognizable: "Person nicht erkennbar",
  inappropriate: "Unangemessen",
} as const;

export type RejectReasonKey = keyof typeof REJECT_REASONS;
