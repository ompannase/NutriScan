import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme";

export function AppScreen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const { colors } = useTheme();
  const content = <View style={styles.content}>{children}</View>;
  return <SafeAreaView edges={["bottom"]} style={[styles.safe, { backgroundColor: colors.background }]}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{content}</ScrollView> : content}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, padding: 20, gap: 20 },
});
