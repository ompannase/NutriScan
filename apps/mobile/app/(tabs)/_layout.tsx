import { Ionicons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import { Pressable } from "react-native";
import { useTheme } from "@/theme";

const icon = (name: React.ComponentProps<typeof Ionicons>["name"]) =>
  ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;

export default function TabLayout() {
  const { colors } = useTheme();
  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 68, paddingBottom: 8 },
    tabBarActiveTintColor: colors.text,
    tabBarInactiveTintColor: colors.muted,
    headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Open nutrition guide" onPress={() => router.push("/conversations")} style={{ padding: 12 }}><Ionicons name="sparkles-outline" size={23} color={colors.text} /></Pressable>,
  }}>
    <Tabs.Screen name="home" options={{ title: "Today", tabBarIcon: icon("home-outline") }} />
    <Tabs.Screen name="scan" options={{ title: "Scan", tabBarIcon: icon("scan-outline") }} />
    <Tabs.Screen name="compare" options={{ title: "Compare", tabBarIcon: icon("git-compare-outline") }} />
    <Tabs.Screen name="nutrition" options={{ title: "Nutrition", tabBarIcon: icon("stats-chart-outline") }} />
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("person-outline") }} />
  </Tabs>;
}
