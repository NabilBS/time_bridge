import { Tabs } from "expo-router";
import { Text } from "react-native";

import { colors, fontSize } from "@/lib/theme";

function tabIcon(symbol: string) {
  return function TabIcon({ color }: { color: string }) {
    return <Text style={{ fontSize: fontSize.subtitle, color }}>{symbol}</Text>;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
        tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Entdecken", tabBarIcon: tabIcon("☀") }} />
      <Tabs.Screen name="anfragen" options={{ title: "Anfragen", tabBarIcon: tabIcon("✉") }} />
      <Tabs.Screen name="chats" options={{ title: "Chats", tabBarIcon: tabIcon("💬") }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: tabIcon("☺") }} />
    </Tabs>
  );
}
