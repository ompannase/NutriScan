import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, EmptyState, Hero, ProgressBar, ProgressRing, Tile } from "@/components/ui";
import { nutritionRepository, productRepository, profileRepository } from "@/database/repositories";
import { sumNutrition } from "@/features/nutrition/normalization";
import type { MealEntry, MealType, Product, UserProfile } from "@/types/models";
import { useTheme } from "@/theme";
import { localDate } from "@/utils/date";

const mealEmoji: Record<string, string> = { breakfast: "🍳", lunch: "🥗", dinner: "🍛", snack: "🍎" };
const mealOrder: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export default function HomeScreen() {
  const { colors } = useTheme();
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
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  return <AppScreen>
    <Animated.View entering={FadeInDown.duration(500)}>
      <Hero>
        <Text style={styles.date}>{today.toUpperCase()}</Text>
        <Text style={styles.greet}>{profile?.name ? `${greeting}, ${profile.name}` : greeting}</Text>
        <Text style={styles.sub}>{entries.length ? `${entries.length} item${entries.length > 1 ? "s" : ""} logged today` : "Nothing logged yet today"}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Add food" onPress={() => router.push("/add-food")} style={styles.addBtn}>
          <Ionicons name="add-circle" size={22} color="#168A50" /><Text style={styles.addText}>Add food</Text>
        </Pressable>
      </Hero>
    </Animated.View>
    <Animated.View entering={FadeInDown.delay(120).duration(500)}>
      <Card>
        <View style={styles.summary}>
          <ProgressRing value={totals.energyKcal === undefined ? undefined : Math.round(totals.energyKcal)} percent={ratio(totals.energyKcal, goals?.calories)} label={goals ? `of ${goals.calories} kcal` : "kcal"} />
          <View style={styles.macros}>
            <ProgressBar label="Protein" color={colors.protein} value={ratio(totals.proteinG, goals?.proteinG)} />
            <ProgressBar label="Carbs" color={colors.carbs} value={ratio(totals.carbsG, goals?.carbsG)} />
            <ProgressBar label="Fat" color={colors.fat} value={ratio(totals.fatG, goals?.fatG)} />
          </View>
        </View>
      </Card>
    </Animated.View>
    <Animated.View entering={FadeInDown.delay(240).duration(500)} style={styles.tiles}>
      <Tile icon="scan-outline" label="Scan" onPress={() => router.push("/(tabs)/scan")} />
      <Tile icon="search-outline" label="Search" onPress={() => router.push("/search")} />
      <Tile icon="sparkles-outline" label="Ask guide" onPress={() => router.push("/conversations")} />
    </Animated.View>
    <Animated.View entering={FadeInDown.delay(360).duration(500)}>
      <Card>
        <View style={styles.row}><View style={styles.inline}><Ionicons name="water" size={20} color={colors.water} /><Body>Water</Body></View><Body muted>{water} / {goals?.waterMl ?? "—"} ml</Body></View>
        <ProgressBar label="Daily water" color={colors.water} value={ratio(water, goals?.waterMl)} />
        <Button label="+ 250 ml" variant="secondary" onPress={async () => { await nutritionRepository.addWater(localDate(), 250); load(); }} />
      </Card>
    </Animated.View>
    <Text style={[styles.section, { color: colors.text }]}>Recent scans</Text>
    {recent.length ? recent.map((product) => <Card key={product.id}><View style={styles.inline}><Text style={styles.emoji}>🛒</Text><View style={styles.grow}><Body>{product.name}</Body><Body muted>{product.brand ?? "Brand not available"}</Body></View></View></Card>) : <EmptyState title="No scans yet" message="Scanned products will appear here. Your history is stored only on this device." />}
    <Text style={[styles.section, { color: colors.text }]}>Today's meal log</Text>
    {mealOrder.map((meal) => {
      const list = entries.filter((entry) => entry.meal === meal);
      const kcal = Math.round(sumNutrition(list.map((entry) => entry.nutrition)).energyKcal ?? 0);
      return <Card key={meal}>
        <View style={styles.row}>
          <View style={styles.inline}><Text style={styles.emoji}>{mealEmoji[meal]}</Text><View><Body>{meal[0]!.toUpperCase() + meal.slice(1)}</Body><Body muted>{list.length ? `${kcal} kcal` : "Nothing yet"}</Body></View></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Add to ${meal}`} onPress={() => router.push({ pathname: "/add-food", params: { meal } })} style={[styles.plus, { backgroundColor: colors.primarySoft }]}><Ionicons name="add" size={22} color={colors.primary} /></Pressable>
        </View>
        {list.map((entry) => <View key={entry.id} style={styles.row}>
          <View style={styles.grow}><Body>{entry.productName}</Body><Body muted>{Math.round(entry.nutrition.energyKcal ?? 0)} kcal · {entry.amountG} g{entry.approximate ? " · approx." : ""}</Body></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${entry.productName}`} onPress={async () => { await nutritionRepository.deleteEntry(entry.id); load(); }} style={styles.trash}><Ionicons name="trash-outline" size={20} color={colors.danger} /></Pressable>
        </View>)}
      </Card>;
    })}
  </AppScreen>;
}
const styles = StyleSheet.create({
  date: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "800", letterSpacing: 1.6 },
  greet: { color: "#FFFFFF", fontSize: 26, fontWeight: "900", letterSpacing: -0.6 },
  sub: { color: "rgba(255,255,255,0.9)", fontSize: 14 },
  summary: { flexDirection: "row", alignItems: "center", gap: 20 },
  macros: { flex: 1, gap: 12 },
  tiles: { flexDirection: "row", gap: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inline: { flexDirection: "row", alignItems: "center", gap: 10 },
  grow: { flex: 1 },
  emoji: { fontSize: 26 },
  section: { fontSize: 18, fontWeight: "800", marginTop: 4 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, marginTop: 12 },
  addText: { color: "#168A50", fontWeight: "800", fontSize: 15 },
  plus: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  trash: { padding: 8 },
});
