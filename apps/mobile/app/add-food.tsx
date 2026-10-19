import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, Chip, Input, Tile } from "@/components/ui";
import { nutritionRepository } from "@/database/repositories";
import type { MealType } from "@/types/models";
import { localDate } from "@/utils/date";
import { createId } from "@/utils/id";
import { useTheme } from "@/theme";

const meals: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

function defaultMeal(): MealType {
  const hour = new Date().getHours();
  return hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 21 ? "dinner" : "snack";
}

const num = (text: string) => (text.trim() === "" ? undefined : Number(text));

export default function AddFoodScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ meal?: string }>();
  const initial = meals.find((m) => m.value === params.meal)?.value ?? defaultMeal();
  const [meal, setMeal] = useState<MealType>(initial);
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [grams, setGrams] = useState("100");
  const [saving, setSaving] = useState(false);
  const calories = num(kcal);
  const valid = name.trim().length > 0 && calories !== undefined && Number.isFinite(calories) && calories >= 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await nutritionRepository.addEntry({
        id: createId(),
        productId: `manual:${createId()}`,
        productName: name.trim(),
        meal,
        amountG: Number(grams) > 0 ? Number(grams) : 100,
        nutrition: { energyKcal: calories, proteinG: num(protein), carbsG: num(carbs), fatG: num(fat) },
        date: localDate(),
        approximate: true,
      });
      router.back();
    } finally { setSaving(false); }
  };

  return <AppScreen>
    <Text style={[styles.heading, { color: colors.text }]}>Which meal?</Text>
    <View style={styles.chips}>
      {meals.map((m) => <Chip key={m.value} label={m.label} selected={meal === m.value} onPress={() => setMeal(m.value)} />)}
    </View>
    <View style={styles.tiles}>
      <Tile icon="search-outline" label="Search product" onPress={() => router.replace("/search")} />
      <Tile icon="scan-outline" label="Scan barcode" onPress={() => router.replace("/(tabs)/scan")} />
    </View>
    <Card>
      <Body>Quick add</Body>
      <Body muted>For home-cooked or restaurant food. Enter the totals for what you ate.</Body>
      <Input label="Food name" value={name} onChangeText={setName} placeholder="e.g. Paneer paratha" />
      <Input label="Calories (kcal)" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" placeholder="e.g. 320" />
      <View style={styles.row}>
        <View style={styles.col}><Input label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" /></View>
        <View style={styles.col}><Input label="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" /></View>
        <View style={styles.col}><Input label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" /></View>
      </View>
      <Input label="Serving size (g)" value={grams} onChangeText={setGrams} keyboardType="decimal-pad" />
      <Button label={`Add to ${meal}`} disabled={!valid || saving} onPress={() => void save()} />
    </Card>
  </AppScreen>;
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tiles: { flexDirection: "row", gap: 10 },
  row: { flexDirection: "row", gap: 8 },
  col: { flex: 1 },
});
