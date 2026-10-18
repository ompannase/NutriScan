import { Ionicons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import { Pressable } from "react-native";
import { useTheme } from "@/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const icon = (name: string) =>
  ({ color, size, focused }: { color: string; size: number; focused: boolean }) => <Ionicons name={(focused ? name.replace("-outline", "") : name) as IconName} color={color} size={size + 1} />;

export default function TabLayout() {
  const { colors } = useTheme();
  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 70, paddingBottom: 10, paddingTop: 6 },
    tabBarLabelStyle: { fontWeight: "700", fontSize: 11 },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Open nutrition guide" onPress={() => router.push("/conversations")} style={{ padding: 12 }}><Ionicons name="sparkles-outline" size={23} color={colors.primary} /></Pressable>,
  }}>
    <Tabs.Screen name="home" options={{ title: "Today", tabBarIcon: icon("home-outline") }} />
    <Tabs.Screen name="scan" options={{ title: "Scan", tabBarIcon: icon("scan-outline") }} />
    <Tabs.Screen name="compare" options={{ title: "Compare", tabBarIcon: icon("git-compare-outline") }} />
    <Tabs.Screen name="nutrition" options={{ title: "Nutrition", tabBarIcon: icon("stats-chart-outline") }} />
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("person-outline") }} />
  </Tabs>;
}
