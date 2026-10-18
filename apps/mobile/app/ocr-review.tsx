import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, Chip, Input, ScreenTitle } from "@/components/ui";
import { parseLabel } from "@/features/ocr/parser";

export default function OcrReviewScreen() {
  const params = useLocalSearchParams<{ text?: string }>();
  const [text, setText] = useState(params.text ?? "");
  const parsed = useMemo(() => parseLabel(text), [text]);
  return <AppScreen>
    <ScreenTitle eyebrow="On-device OCR">Check every value</ScreenTitle>
    <Body muted>Recognition can confuse 0/O, 1/I, and decimal separators. All parsed warnings remain uncertain until you verify the package.</Body>
    <Input label="Extracted text" multiline value={text} onChangeText={setText} style={styles.editor} />
    <Card>
      <View style={styles.row}><Body>Ingredients</Body><Chip label={parsed.ingredients ? `${Math.round(parsed.ingredients.confidence * 100)}% · uncertain` : "Not detected"} /></View>
      <Body muted>{parsed.ingredients?.value ?? "Not available"}</Body>
    </Card>
    <Card>
      <View style={styles.row}><Body>Allergens</Body><Chip label={parsed.allergens ? `${Math.round(parsed.allergens.confidence * 100)}% · uncertain` : "Not detected"} /></View>
      <Body muted>{parsed.allergens?.value ?? "Not available"}</Body>
    </Card>
    <Card><Body>Nutrition declaration</Body>{Object.entries(parsed.nutrition).map(([key, value]) => <View style={styles.row} key={key}><Body muted>{key}</Body><Body>{value === undefined ? "Not available" : String(value)}</Body></View>)}</Card>
    <Button label="Save as custom product" onPress={() => router.push({ pathname: "/product/custom", params: { ocr: text } })} />
  </AppScreen>;
}
const styles = StyleSheet.create({ editor: { minHeight: 180, textAlignVertical: "top", paddingTop: 16 }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 } });
