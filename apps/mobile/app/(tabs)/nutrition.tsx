import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, Chip, EmptyState, ErrorState, Input, Loading, ProgressBar, ScreenTitle, Sheet } from "@/components/ui";
import { nutritionRepository, profileRepository } from "@/database/repositories";
import { scaleNutrition, sumNutrition } from "@/features/nutrition/normalization";
import { useTheme } from "@/theme";
import type { MealEntry, MealType, UserProfile } from "@/types/models";
import { localDate } from "@/utils/date";

const meals: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const mealLabel = (meal: MealType) => meal[0]!.toUpperCase() + meal.slice(1);

export default function NutritionScreen() {
  const { colors } = useTheme();
  const [date, setDate] = useState(new Date());
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [weeklyEntries, setWeeklyEntries] = useState<MealEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [water, setWater] = useState(0);
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMeal, setEditMeal] = useState<MealType>("snack");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const day = localDate(date);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() - (6 - index)),
  ), [day]);
  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      nutritionRepository.entries(day),
      nutritionRepository.entriesBetween(localDate(weekDates[0]), localDate(weekDates[6])),
      nutritionRepository.hydration(day),
      profileRepository.get(),
    ])
      .then(([nextEntries, nextWeeklyEntries, nextWater, nextProfile]) => {
        setEntries(nextEntries);
        setWeeklyEntries(nextWeeklyEntries);
        setWater(nextWater);
        setProfile(nextProfile);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [day, weekDates]);
  useFocusEffect(load);
  const totals = useMemo(() => sumNutrition(entries.map((entry) => entry.nutrition)), [entries]);
  const weeklyTotals = useMemo(() => weekDates.map((chartDate) => {
    const chartDay = localDate(chartDate);
    return sumNutrition(weeklyEntries.filter((entry) => entry.date === chartDay).map((entry) => entry.nutrition)).energyKcal;
  }), [weekDates, weeklyEntries]);
  const move = (days: number) => setDate((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + days));
  const ratio = (value?: number, target?: number) => target ? ((value ?? 0) / target) * 100 : 0;
  const openEditor = (entry: MealEntry) => {
    setEditing(entry);
    setEditAmount(String(entry.amountG));
    setEditMeal(entry.meal);
  };
  const saveEdit = async () => {
    const nextAmount = Number(editAmount);
    if (!editing || !Number.isFinite(nextAmount) || nextAmount <= 0) return;
    await nutritionRepository.addEntry({
      ...editing,
      meal: editMeal,
      amountG: nextAmount,
      nutrition: scaleNutrition(editing.nutrition, nextAmount, editing.amountG),
    });
    setEditing(null);
    load();
  };
  return <AppScreen>
    <ScreenTitle eyebrow="Daily log">Nutrition</ScreenTitle>
    <View style={styles.navigator}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => move(-1)} style={styles.navButton}><Text style={{ color: colors.text, fontSize: 22 }}>‹</Text></Pressable>
      <Body>{date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</Body>
      <Pressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => move(1)} style={styles.navButton}><Text style={{ color: colors.text, fontSize: 22 }}>›</Text></Pressable>
    </View>
    {loading ? <Loading /> : error ? <ErrorState message="Your nutrition log could not be loaded." retry={load} /> : <>
    <Card>
      <ProgressBar label={`Energy ${Math.round(totals.energyKcal ?? 0)} / ${profile?.goals.calories ?? "—"} kcal`} value={ratio(totals.energyKcal, profile?.goals.calories)} />
      <ProgressBar label={`Protein ${Math.round(totals.proteinG ?? 0)} g`} value={ratio(totals.proteinG, profile?.goals.proteinG)} />
      <ProgressBar label={`Carbs ${Math.round(totals.carbsG ?? 0)} g`} value={ratio(totals.carbsG, profile?.goals.carbsG)} />
      <ProgressBar label={`Fat ${Math.round(totals.fatG ?? 0)} g`} value={ratio(totals.fatG, profile?.goals.fatG)} />
    </Card>
    <Card>
      <View style={styles.row}><Body>Water</Body><Body muted>{water} ml</Body></View>
      <ProgressBar label="Water goal" value={ratio(water, profile?.goals.waterMl)} />
      <View style={styles.buttons}><View style={styles.grow}><Button label="+ 250 ml" variant="secondary" onPress={async () => { await nutritionRepository.addWater(day, 250); load(); }} /></View><View style={styles.grow}><Button label="Undo" variant="secondary" onPress={async () => { await nutritionRepository.undoWater(day); load(); }} /></View></View>
    </Card>
    {meals.map((meal) => {
      const rows = entries.filter((entry) => entry.meal === meal);
      return <View key={meal} style={styles.section}>
        <View style={styles.row}><Body>{meal[0]!.toUpperCase() + meal.slice(1)}</Body><Body muted>{Math.round(sumNutrition(rows.map((entry) => entry.nutrition)).energyKcal ?? 0)} kcal</Body></View>
        {rows.length ? rows.map((entry) => <Card key={entry.id}>
          <View style={styles.row}>
            <View style={styles.entryCopy}><Body>{entry.productName}</Body><Body muted>{entry.amountG} g{entry.approximate ? " · approximate" : ""}</Body></View>
            <View style={styles.entryActions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${entry.productName}`} onPress={() => openEditor(entry)}><Text style={{ color: colors.text, fontWeight: "700" }}>Edit</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${entry.productName}`} onPress={async () => { await nutritionRepository.deleteEntry(entry.id); load(); }}><Text style={{ color: colors.danger, fontWeight: "700" }}>Delete</Text></Pressable>
            </View>
          </View>
        </Card>) : <EmptyState title={`No ${meal} items`} message="Foods added to this meal will appear here." />}
      </View>;
    })}
    <Body>7-day energy</Body>
    <View style={[styles.chart, { borderColor: colors.border }]}>{weekDates.map((chartDate, index) => {
      const energy = weeklyTotals[index];
      return <View key={localDate(chartDate)} style={styles.barColumn}>
        <View style={styles.barArea}>
          {energy ? <View accessibilityLabel={`${Math.round(energy)} calories`} style={[styles.bar, { backgroundColor: index === 6 ? colors.primary : colors.elevated, height: `${Math.max(4, Math.min(100, ratio(energy, profile?.goals.calories)))}%` }]} /> : null}
        </View>
        <Text style={[styles.dayLabel, { color: index === 6 ? colors.text : colors.muted }]}>{chartDate.toLocaleDateString(undefined, { weekday: "narrow" })}</Text>
      </View>;
    })}</View>
    <Body muted>Bars use local calendar days. No values are shown for days without entries.</Body>
    </>}
    <Sheet visible={Boolean(editing)} title="Edit meal entry" onClose={() => setEditing(null)}>
      <Input label="Portion amount (g/ml)" value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" />
      <Body>Meal</Body>
      <View style={styles.mealOptions}>
        {meals.map((meal) => <Chip key={meal} label={mealLabel(meal)} selected={editMeal === meal} onPress={() => setEditMeal(meal)} />)}
      </View>
      <Body muted>Nutrients are rescaled from the amount originally logged.</Body>
      <Button label="Save changes" disabled={!Number(editAmount) || Number(editAmount) <= 0} onPress={() => void saveEdit()} />
    </Sheet>
  </AppScreen>;
}
const styles = StyleSheet.create({
  navigator: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navButton: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  buttons: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
  section: { gap: 10 },
  entryCopy: { flex: 1 },
  entryActions: { flexDirection: "row", gap: 16 },
  mealOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chart: { height: 176, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-around" },
  barColumn: { flex: 1, alignItems: "center" },
  barArea: { height: 148, width: "100%", alignItems: "center", justifyContent: "flex-end" },
  bar: { width: 24, minHeight: 4, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  dayLabel: { fontSize: 12, fontWeight: "700", paddingTop: 8 },
});
