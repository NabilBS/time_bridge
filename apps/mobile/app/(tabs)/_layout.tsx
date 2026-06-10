import { Tabs } from "expo-router";
import { Text } from "react-native";

import { colors, fontSize } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 14, fontWeight: "600" },
        tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Start",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: fontSize.subtitle, color }}>⌂</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: fontSize.subtitle, color }}>☺</Text>
          ),
        }}
      />
    </Tabs>
  );
}
