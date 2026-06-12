import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { NotificationDeepLinks } from "@/components/NotificationDeepLinks";
import { OnboardingProvider } from "@/lib/onboarding";
import { initSentry, Sentry, sentryEnabled } from "@/lib/sentry";

initSentry();

function RootLayout() {
  return (
    <OnboardingProvider>
      <StatusBar style="dark" />
      <NotificationDeepLinks />
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingProvider>
  );
}

export default sentryEnabled ? Sentry.wrap(RootLayout) : RootLayout;
