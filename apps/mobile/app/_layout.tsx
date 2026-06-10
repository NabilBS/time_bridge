import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { NotificationDeepLinks } from "@/components/NotificationDeepLinks";
import { OnboardingProvider } from "@/lib/onboarding";

export default function RootLayout() {
  return (
    <OnboardingProvider>
      <StatusBar style="dark" />
      <NotificationDeepLinks />
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingProvider>
  );
}
