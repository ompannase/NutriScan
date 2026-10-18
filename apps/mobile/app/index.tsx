import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInUp, ZoomIn } from "react-native-reanimated";
import { useSettingsStore } from "@/stores/settings";
import { useTheme } from "@/theme";

/** Animated launch screen, then routes to onboarding or the app. */
export default function Index() {
  const { colors } = useTheme();
  const complete = useSettingsStore((state) => state.onboardingComplete);
  const [done, setDone] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setDone(true), 2200); return () => clearTimeout(timer); }, []);
  if (done) return <Redirect href={complete ? "/(tabs)/home" : "/(onboarding)"} />;
  return <LinearGradient colors={[colors.gradA, colors.gradB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
    <Animated.View entering={ZoomIn.duration(700).springify().damping(12)} style={styles.logo}>
      <Ionicons name="nutrition" size={58} color="#168A50" />
    </Animated.View>
    <Animated.Text entering={FadeInUp.delay(500).duration(600)} style={styles.name}>NutriScan</Animated.Text>
    <Animated.Text entering={FadeIn.delay(1000).duration(600)} style={styles.tag}>Know what you eat</Animated.Text>
    <View style={styles.dots}>{[0, 1, 2].map((i) => <Animated.View key={i} entering={FadeIn.delay(1300 + i * 150)} style={styles.dot} />)}</View>
  </LinearGradient>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  logo: { width: 112, height: 112, borderRadius: 36, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  name: { fontSize: 38, fontWeight: "900", color: "#FFFFFF", letterSpacing: -1, marginTop: 10 },
  tag: { fontSize: 16, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  dots: { flexDirection: "row", gap: 8, marginTop: 28 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.8)" },
});
