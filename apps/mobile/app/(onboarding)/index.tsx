import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, ScreenTitle } from "@/components/ui";
import { useTheme } from "@/theme";

export default function WelcomeScreen() {
  const { colors } = useTheme();
  return <AppScreen>
    <View style={styles.hero}>
      <View style={[styles.mark, { backgroundColor: colors.primary }]}>
        <Text style={[styles.markText, { color: colors.inverse }]}>N</Text>
      </View>
      <ScreenTitle eyebrow="Know what you eat">Scan food. Understand more.</ScreenTitle>
      <Body muted>NutriScan turns labels and barcodes into clear, personal nutrition context—without inventing what isn't there.</Body>
    </View>
    <Card>
      <Body>Barcode intelligence</Body>
      <Body muted>Compare nutrients on a consistent per-100g basis.</Body>
      <Body>Personal context</Body>
      <Body muted>Spot ingredients that matter to your preferences and allergies.</Body>
    </Card>
    <View style={styles.bottom}><Button label="Get started" onPress={() => router.push("/(onboarding)/disclaimer")} /></View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  hero: { marginTop: 44, gap: 16 },
  mark: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  markText: { fontSize: 28, fontWeight: "900" },
  bottom: { marginTop: "auto" },
});
