import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Body, Card, Chip, EmptyState, ScreenTitle } from "@/components/ui";
import { productRepository, profileRepository } from "@/database/repositories";
import { scoreProduct } from "@/features/scoring";
import { useTheme } from "@/theme";
import type { Condition, Nutrition, Product, UserProfile } from "@/types/models";

const rows: [keyof Nutrition, string, "lower" | "higher"][] = [
  ["energyKcal", "Energy", "lower"], ["proteinG", "Protein", "higher"], ["carbsG", "Carbs", "lower"],
  ["sugarsG", "Sugars", "lower"], ["fatG", "Fat", "lower"], ["saturatedFatG", "Sat fat", "lower"],
  ["fibreG", "Fibre", "higher"], ["sodiumMg", "Sodium", "lower"],
];

export default function CompareScreen() {
  const { colors } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [temporaryConditions, setTemporaryConditions] = useState<Condition[] | null>(null);
  useFocusEffect(useCallback(() => { Promise.all([productRepository.recent(), profileRepository.get()]).then(([p, u]) => { setProducts(p); setProfile(u); }); }, []));
  const compared = useMemo(() => products.filter((product) => selected.includes(product.id)).slice(0, 4), [products, selected]);
  const activeConditions = temporaryConditions ?? profile?.conditions ?? [];
  const toggleCondition = (condition: Condition) => setTemporaryConditions((current) => {
    const base = current ?? profile?.conditions ?? [];
    return base.includes(condition) ? base.filter((item) => item !== condition) : [...base, condition];
  });
  return <AppScreen>
    <ScreenTitle eyebrow="Per 100 g/ml">Compare products</ScreenTitle>
    <Body muted>Choose 2–4 recent products. Missing data stays neutral and price never affects ranking.</Body>
    <Card>
      <View style={styles.profileHeader}><View style={styles.profileCopy}><Body>Scoring profile</Body><Body muted>Temporary for this comparison; your saved profile will not change.</Body></View></View>
      <View style={styles.profileOptions}>
        <Chip label="Saved" selected={temporaryConditions === null} onPress={() => setTemporaryConditions(null)} />
        <Chip label="General" selected={temporaryConditions?.length === 0} onPress={() => setTemporaryConditions([])} />
        <Chip label="Type 2 diabetes" selected={activeConditions.includes("type2-diabetes")} onPress={() => toggleCondition("type2-diabetes")} />
        <Chip label="Hypertension" selected={activeConditions.includes("hypertension")} onPress={() => toggleCondition("hypertension")} />
      </View>
    </Card>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picker}>
      {products.map((product) => <Chip key={product.id} label={product.name} selected={selected.includes(product.id)} onPress={() => setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : current.length < 4 ? [...current, product.id] : current)} />)}
    </ScrollView>
    {products.length === 0 ? <EmptyState title="No products to compare" message="Scan products first; no sample products are added automatically." /> : compared.length < 2 ? <EmptyState title="Pick at least two" message="Select recent products above to see normalized differences." /> : <Card>
      <ScrollView horizontal>
        <View>
          <View style={styles.tableRow}><Cell value="Metric" header /><View style={styles.columns}>{compared.map((product) => <Cell key={product.id} value={product.name} header />)}</View></View>
          {rows.map(([key, label, direction]) => {
            const available = compared.flatMap((product) => product.nutritionPer100[key] === undefined ? [] : [product.nutritionPer100[key]!]);
            const best = direction === "lower" ? Math.min(...available) : Math.max(...available);
            return <View key={key} style={styles.tableRow}><Cell value={label} /><View style={styles.columns}>{compared.map((product) => {
              const value = product.nutritionPer100[key];
              const meaningful = value !== undefined && available.length > 1 && value === best && Math.max(...available) - Math.min(...available) > Math.max(1, best * 0.1);
              return <Cell key={product.id} value={value === undefined ? "Not available" : `${Math.round(value * 10) / 10}`} favorable={meaningful} />;
            })}</View></View>;
          })}
          <View style={styles.tableRow}><Cell value="Score" /><View style={styles.columns}>{compared.map((product) => <Cell key={product.id} value={String(scoreProduct(product.nutritionPer100, product.novaGroup, activeConditions).score ?? "Insufficient")} />)}</View></View>
          <View style={styles.tableRow}><Cell value="Price" /><View style={styles.columns}>{compared.map((product) => <Cell key={product.id} value="Price unavailable" />)}</View></View>
        </View>
      </ScrollView>
    </Card>}
    <Card><Body>Why ranking can change</Body><Body muted>{activeConditions.some((item) => item === "type2-diabetes" || item === "hypertension") ? "The active comparison profile increases emphasis on relevant sugar or sodium values. Allergies remain safety flags, not score adjustments." : "The general profile balances sugar, saturated fat, sodium, fibre, protein, and processing."}</Body></Card>
  </AppScreen>;
  function Cell({ value, header, favorable }: { value: string; header?: boolean; favorable?: boolean }) {
    return <View style={[styles.cell, { borderColor: colors.border, backgroundColor: favorable ? `${colors.favorable}18` : "transparent" }]}><Text numberOfLines={2} style={{ color: favorable ? colors.favorable : colors.text, fontWeight: header || favorable ? "700" : "400" }}>{value}</Text></View>;
  }
}
const styles = StyleSheet.create({ picker: { gap: 8 }, profileHeader: { flexDirection: "row", justifyContent: "space-between" }, profileCopy: { flex: 1, gap: 4 }, profileOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, tableRow: { flexDirection: "row" }, columns: { flexDirection: "row" }, cell: { width: 128, minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: "center", padding: 10 } });
