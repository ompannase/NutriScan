import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, Chip, EmptyState, ErrorState, Input, Loading, ProgressBar, ProgressRing, ScreenTitle, Sheet } from "@/components/ui";
import { favoriteRepository, nutritionRepository, profileRepository } from "@/database/repositories";
import { scaleNutrition } from "@/features/nutrition/normalization";
import { matchAllergies } from "@/features/scoring/allergy";
import { scoreProduct } from "@/features/scoring";
import { productService } from "@/services/product";
import type { MealType, Nutrition } from "@/types/models";
import { AppError, friendlyError } from "@/utils/errors";
import { useTheme } from "@/theme";
import { createId } from "@/utils/id";
import { localDate } from "@/utils/date";

const nutritionRows: [keyof Nutrition, string, string][] = [
  ["energyKcal", "Energy", "kcal"], ["proteinG", "Protein", "g"], ["carbsG", "Carbohydrate", "g"],
  ["sugarsG", "Sugars", "g"], ["fatG", "Fat", "g"], ["saturatedFatG", "Saturated fat", "g"],
  ["fibreG", "Fibre", "g"], ["sodiumMg", "Sodium", "mg"], ["saltG", "Salt", "g"],
];
const meals: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export default function ProductScreen() {
  const { colors } = useTheme();
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const [expanded, setExpanded] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [portion, setPortion] = useState("100");
  const [meal, setMeal] = useState<MealType>("snack");
  const query = useQuery({
    queryKey: ["product", barcode],
    queryFn: ({ signal }) => productService.getByBarcode(barcode, signal),
  });
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: () => profileRepository.get() });
  useEffect(() => { if (query.data) void favoriteRepository.has(query.data.id).then(setFavorite); }, [query.data]);
  if (query.isLoading) return <AppScreen><Loading /><Card><ProgressBar label="Checking product data" value={45} /></Card></AppScreen>;
  if (query.error instanceof AppError && query.error.code === "NOT_FOUND") return <AppScreen>
    <ScreenTitle>Product not found</ScreenTitle>
    <EmptyState title="Help build your local library" message="Try a label scan or add verified values from the package. Custom products are clearly marked unverified." />
    <Button label="Scan nutrition label" onPress={() => router.replace("/(tabs)/scan")} />
    <Button label="Add manually" variant="secondary" onPress={() => router.push({ pathname: "/product/custom", params: { barcode } })} />
  </AppScreen>;
  if (query.error || !query.data) return <AppScreen><ErrorState message={friendlyError(query.error)} retry={() => void query.refetch()} /></AppScreen>;
  const product = query.data;
  const score = scoreProduct(product.nutritionPer100, product.novaGroup, profileQuery.data?.conditions);
  const warnings = matchAllergies(product.ingredients ?? "", profileQuery.data?.allergies ?? [], product.origin === "ocr-derived");
  return <AppScreen>
    {product.imageUrl ? <Image source={product.imageUrl} contentFit="contain" style={[styles.image, { backgroundColor: colors.surface }]} /> : null}
    <ScreenTitle eyebrow={product.brand ?? "Brand not available"}>{product.name}</ScreenTitle>
    <View style={styles.meta}><Chip label={product.source} /><Chip label={product.verified ? "Verified source" : "Unverified"} /></View>
    <Card>
      <View style={styles.scoreRow}>
        <ProgressRing value={score.score} label={score.category} />
        <View style={styles.grow}><Body>{score.category}</Body><Body muted>{score.score === undefined ? "Not enough critical data to calculate a score." : `Scoring model ${score.version}`}</Body><ProgressBar label="Data completeness" value={score.completeness} /></View>
      </View>
      <Button label={expanded ? "Hide breakdown" : "Show score breakdown"} variant="secondary" onPress={() => setExpanded(!expanded)} />
      {expanded ? score.breakdown.map((item) => <View key={item.key} style={styles.row}><View style={styles.grow}><Body>{item.label}</Body><Body muted>{item.reason}</Body></View><Text style={{ color: item.points > 0 ? colors.favorable : colors.warning, fontWeight: "800" }}>{item.points > 0 ? "+" : ""}{item.points}</Text></View>) : null}
    </Card>
    {warnings.length ? <Card><Body>Personalized warnings</Body>{warnings.map((item) => <View key={`${item.allergen}-${item.kind}`}><Body>{item.allergen}: {item.kind}</Body><Body muted>Matched “{item.matchedTerm}”. Always verify the package.</Body></View>)}</Card> : null}
    <Card>
      <Body>Nutrition per 100 g/ml</Body>
      {nutritionRows.map(([key, label, unit]) => <View key={key} style={styles.row}><Body muted>{label}</Body><Body>{product.nutritionPer100[key] === undefined ? "Not available" : `${product.nutritionPer100[key]} ${unit}`}</Body></View>)}
    </Card>
    <Card><Body>Ingredients</Body><Body muted>{product.ingredients || "Not available"}</Body></Card>
    <Card><Body>Product details</Body><View style={styles.row}><Body muted>Quantity</Body><Body>{product.quantity ?? "Not available"}</Body></View><View style={styles.row}><Body muted>Processing</Body><Body>{product.novaGroup ? `NOVA ${product.novaGroup}` : "Not available"}</Body></View><View style={styles.row}><Body muted>Retrieved</Body><Body>{new Date(product.retrievedAt).toLocaleDateString()}</Body></View></Card>
    <Button label="Compare" onPress={() => router.push("/(tabs)/compare")} />
    <Button label={favorite ? "Remove from favorites" : "Add to favorites"} variant="secondary" onPress={async () => { await favoriteRepository.toggle(product.id); setFavorite(!favorite); }} />
    <Button label="Log meal" variant="secondary" onPress={() => setLogOpen(true)} />
    <Button label="Ask guide" variant="secondary" onPress={() => router.push({ pathname: "/chat", params: { barcode } })} />
    <Button label="Explain this score" variant="secondary" onPress={() => router.push({ pathname: "/chat", params: { barcode, prompt: "Explain why this product got its score." } })} />
    <Button label="Healthier alternatives" variant="secondary" onPress={() => router.push({ pathname: "/chat", params: { barcode, prompt: "Suggest healthier alternatives to this product." } })} />
    <Sheet visible={logOpen} title="Log this food" onClose={() => setLogOpen(false)}>
      <Input label="Portion amount (g/ml)" value={portion} onChangeText={setPortion} keyboardType="decimal-pad" />
      <Body>Meal</Body>
      <View style={styles.meta}>
        {meals.map((option) => <Chip key={option.value} label={option.label} selected={meal === option.value} onPress={() => setMeal(option.value)} />)}
      </View>
      <Body muted>Nutrients scale proportionally from the per-100g/ml values. It is marked approximate when product data is incomplete.</Body>
      <Button label={`Add to ${meal}`} disabled={!Number(portion) || Number(portion) <= 0} onPress={async () => {
        const amountG = Number(portion);
        await nutritionRepository.addEntry({
          id: createId(), productId: product.id, productName: product.name, meal,
          amountG, nutrition: scaleNutrition(product.nutritionPer100, amountG), date: localDate(),
          approximate: score.completeness < 100,
        });
        setLogOpen(false);
      }} />
    </Sheet>
  </AppScreen>;
}
const styles = StyleSheet.create({ image: { width: "100%", height: 220, borderRadius: 16 }, meta: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, scoreRow: { flexDirection: "row", gap: 20, alignItems: "center" }, grow: { flex: 1, gap: 8 }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 } });
