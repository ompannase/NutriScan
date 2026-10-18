import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, ScreenTitle } from "@/components/ui";
import { useTheme } from "@/theme";

export default function DisclaimerScreen() {
  const [accepted, setAccepted] = useState(false);
  const { colors } = useTheme();
  return <AppScreen>
    <ScreenTitle eyebrow="Before you continue">A guide, not a diagnosis</ScreenTitle>
    <Card>
      <Body>NutriScan supports educational dietary awareness. It does not provide medical advice, diagnose conditions, or replace guidance from a qualified professional.</Body>
      <Body muted>Scores are project-defined comparisons. Ingredient and OCR data may be incomplete, so always check the package when safety matters.</Body>
    </Card>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} accessibilityLabel="Acknowledge disclaimer" onPress={() => setAccepted(!accepted)} style={styles.checkRow}>
      <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: accepted ? colors.primary : colors.surface }]}>
        <Text style={{ color: colors.inverse }}>{accepted ? "✓" : ""}</Text>
      </View>
      <Body>I understand and want to continue.</Body>
    </Pressable>
    <View style={styles.bottom}><Button label="Continue" disabled={!accepted} onPress={() => router.push("/(onboarding)/profile")} /></View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  checkRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  bottom: { marginTop: "auto" },
});
