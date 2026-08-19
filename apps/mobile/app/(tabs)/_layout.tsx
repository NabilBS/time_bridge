import { Tabs } from "expo-router";
import { Text } from "react-native";

import { colors, fontSize, fontWeight, tabBar } from "@/lib/theme";

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
        tabBarLabelStyle: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold },
        tabBarStyle: {
          height: tabBar.height,
          paddingBottom: tabBar.paddingBottom,
          paddingTop: tabBar.paddingTop,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Entdecken", tabBarIcon: tabIcon("☀") }} />
      <Tabs.Screen name="anfragen" options={{ title: "Anfragen", tabBarIcon: tabIcon("✉") }} />
      <Tabs.Screen name="chats" options={{ title: "Chats", tabBarIcon: tabIcon("💬") }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: tabIcon("☺") }} />
    </Tabs>
  );
}
