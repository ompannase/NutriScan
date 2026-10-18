import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, Hero } from "@/components/ui";
import { useTheme } from "@/theme";

const features: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; text: string }[] = [
  { icon: "barcode-outline", title: "Barcode intelligence", text: "Compare nutrients on a consistent per-100g basis." },
  { icon: "heart-outline", title: "Personal context", text: "Spot ingredients that matter to your preferences and allergies." },
  { icon: "stats-chart-outline", title: "Track your day", text: "Log meals and see calories and macros at a glance." },
];

export default function WelcomeScreen() {
  const { colors } = useTheme();
  return <AppScreen>
    <Animated.View entering={FadeInDown.duration(600)}>
      <Hero>
        <View style={styles.mark}><Ionicons name="nutrition" size={34} color="#168A50" /></View>
        <Text style={styles.eyebrow}>KNOW WHAT YOU EAT</Text>
        <Text style={styles.title}>Scan food. Understand more.</Text>
        <Text style={styles.sub}>Clear, personal nutrition context from labels and barcodes, without inventing what isn't there.</Text>
      </Hero>
    </Animated.View>
    {features.map((f, i) => <Animated.View key={f.title} entering={FadeInDown.delay(250 + i * 150).duration(500)}>
      <Card><View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Ionicons name={f.icon} size={22} color={colors.primary} /></View>
        <View style={styles.grow}><Body>{f.title}</Body><Body muted>{f.text}</Body></View>
      </View></Card>
    </Animated.View>)}
    <View style={styles.bottom}><Button label="Get started" onPress={() => router.push("/(onboarding)/disclaimer")} /></View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  mark: { width: 60, height: 60, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  eyebrow: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: "#FFFFFF", fontSize: 32, lineHeight: 38, fontWeight: "900", letterSpacing: -0.8 },
  sub: { color: "rgba(255,255,255,0.9)", fontSize: 15, lineHeight: 22, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  icon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1 },
  bottom: { marginTop: "auto" },
});
