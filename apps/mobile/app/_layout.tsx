import "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useTheme } from "@/theme";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5 * 60 * 1000 } },
});

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  useAutoSync(queryClient);
  return <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="product/[barcode]" options={{ title: "Product" }} />
          <Stack.Screen name="product/custom" options={{ title: "Custom product", presentation: "modal" }} />
          <Stack.Screen name="ocr-review" options={{ title: "Review label" }} />
          <Stack.Screen name="chat" options={{ title: "NutriScan guide" }} />
          <Stack.Screen name="conversations" options={{ title: "Conversations" }} />
          <Stack.Screen name="add-food" options={{ title: "Add food", presentation: "modal" }} />
          <Stack.Screen name="search" options={{ title: "Find a product" }} />
          <Stack.Screen name="account" options={{ title: "Sync", presentation: "modal" }} />
          <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
          <Stack.Screen name="settings/profile" options={{ title: "Edit profile" }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>;
}
