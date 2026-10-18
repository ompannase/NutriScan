import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, EmptyState, ProgressBar, ProgressRing, ScreenTitle } from "@/components/ui";
import { nutritionRepository, productRepository, profileRepository } from "@/database/repositories";
import { sumNutrition } from "@/features/nutrition/normalization";
import type { MealEntry, Product, UserProfile } from "@/types/models";
import { localDate } from "@/utils/date";

export default function HomeScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [recent, setRecent] = useState<Product[]>([]);
  const [water, setWater] = useState(0);
  const load = useCallback(() => {
    Promise.all([profileRepository.get(), nutritionRepository.entries(localDate()), nutritionRepository.hydration(localDate()), productRepository.recent(3)])
      .then(([p, e, w, r]) => { setProfile(p); setEntries(e); setWater(w); setRecent(r); });
  }, []);
  useFocusEffect(load);
  const totals = sumNutrition(entries.map((entry) => entry.nutrition));
  const goals = profile?.goals;
  const ratio = (value?: number, goal?: number) => goal ? ((value ?? 0) / goal) * 100 : 0;
  return <AppScreen>
    <ScreenTitle eyebrow="Today">{profile?.name ? `Good day, ${profile.name}` : "Your nutrition, clearly"}</ScreenTitle>
    <Card>
      <View style={styles.summary}>
        <ProgressRing value={totals.energyKcal === undefined ? undefined : Math.round(totals.energyKcal)} label={goals ? `of ${goals.calories} kcal` : "kcal"} />
        <View style={styles.macros}>
          <ProgressBar label="Protein" value={ratio(totals.proteinG, goals?.proteinG)} />
          <ProgressBar label="Carbs" value={ratio(totals.carbsG, goals?.carbsG)} />
          <ProgressBar label="Fat" value={ratio(totals.fatG, goals?.fatG)} />
        </View>
      </View>
    </Card>
    <Card>
      <View style={styles.row}><Body>Water</Body><Body muted>{water} / {goals?.waterMl ?? "—"} ml</Body></View>
      <ProgressBar label="Daily water" value={ratio(water, goals?.waterMl)} />
      <Button label="+ 250 ml" variant="secondary" onPress={async () => { await nutritionRepository.addWater(localDate(), 250); load(); }} />
    </Card>
    <View style={styles.actions}>
      <Button label="Scan barcode" onPress={() => router.push("/(tabs)/scan")} />
      <Button label="Search products" variant="secondary" onPress={() => router.push("/search")} />
      <Button label="Ask guide" variant="secondary" onPress={() => router.push("/conversations")} />
    </View>
    <Body>Recent scans</Body>
    {recent.length ? recent.map((product) => <Card key={product.id}><Body>{product.name}</Body><Body muted>{product.brand ?? "Brand not available"}</Body></Card>) : <EmptyState title="No scans yet" message="Scanned products will appear here. Your history is stored only on this device." />}
    <Body>Today's meal log</Body>
    {entries.length ? entries.map((entry) => <Card key={entry.id}><View style={styles.row}><Body>{entry.productName}</Body><Body muted>{entry.amountG} g</Body></View></Card>) : <EmptyState title="Nothing logged today" message="Add food from a product result or the Nutrition tab." />}
  </AppScreen>;
}
const styles = StyleSheet.create({ summary: { flexDirection: "row", alignItems: "center", gap: 20 }, macros: { flex: 1, gap: 12 }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, actions: { gap: 8 } });
