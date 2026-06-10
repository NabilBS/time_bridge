import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { OnboardingProvider } from "@/lib/onboarding";

export default function RootLayout() {
  return (
    <OnboardingProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingProvider>
  );
}
