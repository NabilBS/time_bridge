import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Nur in Production-Builds aktiv; ohne DSN passiert nichts. */
export const sentryEnabled = !__DEV__ && !!dsn;

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.]+/g;
/** Pfade im Bucket verification-docs: <uuid>/<uuid>.<ext> */
const DOCUMENT_PATH_PATTERN = /[0-9a-f-]{36}\/[0-9a-f-]{36}\.\w+/gi;

function scrubText(text: string): string {
  return text
    .replace(EMAIL_PATTERN, "[email entfernt]")
    .replace(DOCUMENT_PATH_PATTERN, "[dokumentpfad entfernt]");
}

export function initSentry(): void {
  if (!sentryEnabled || !dsn) return;
  Sentry.init({
    dsn,
    // Niemals personenbezogene Daten: keine IP/User-Defaults, …
    sendDefaultPii: false,
    beforeSend(event) {
      // … keine Nutzerkennungen, keine E-Mails, keine Dokumentpfade,
      // keine Nachrichteninhalte in Breadcrumbs.
      delete event.user;
      if (event.message) event.message = scrubText(event.message);
      for (const exception of event.exception?.values ?? []) {
        if (exception.value) exception.value = scrubText(exception.value);
      }
      event.breadcrumbs = (event.breadcrumbs ?? []).filter(
        (crumb) => crumb.category !== "console" && crumb.category !== "xhr",
      );
      for (const crumb of event.breadcrumbs) {
        if (crumb.message) crumb.message = scrubText(crumb.message);
        delete crumb.data;
      }
      delete event.request;
      return event;
    },
  });
}

export { Sentry };
