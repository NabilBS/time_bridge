import type { z } from "zod";

/** Erste Zod-Fehlermeldung als deutsche Formularmeldung. */
export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Bitte prüfen Sie Ihre Eingaben.";
}

/** FormData-Wert als getrimmter String (fehlend → leerer String). */
export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
