import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { z } from "zod";
import { Body, Button, Chip, Input } from "@/components/ui";
import type { UserProfile } from "@/types/models";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  dietaryPreference: z.enum(["general", "vegetarian", "vegan"]),
  allergiesText: z.string(),
  conditions: z.array(z.enum(["type2-diabetes", "hypertension", "celiac"])),
  calories: z.string().refine((value) => Number(value) >= 800 && Number(value) <= 6000, "Use 800–6000"),
  proteinG: z.string().refine((value) => Number(value) >= 0 && Number(value) <= 500, "Use 0–500"),
  carbsG: z.string().refine((value) => Number(value) >= 0 && Number(value) <= 1000, "Use 0–1000"),
  fatG: z.string().refine((value) => Number(value) >= 0 && Number(value) <= 500, "Use 0–500"),
  waterMl: z.string().refine((value) => Number(value) >= 250 && Number(value) <= 10000, "Use 250–10000"),
});
type Values = z.infer<typeof schema>;

const defaults: Values = {
  name: "", dietaryPreference: "general", allergiesText: "", conditions: [],
  calories: "2000", proteinG: "75", carbsG: "250", fatG: "65", waterMl: "2000",
};

export function ProfileForm({ initial, submitLabel, onSubmit }: { initial?: UserProfile; submitLabel: string; onSubmit: (profile: UserProfile) => Promise<void> | void }) {
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial ? {
      name: initial.name, dietaryPreference: initial.dietaryPreference,
      allergiesText: initial.allergies.join(", "), conditions: initial.conditions,
      calories: String(initial.goals.calories), proteinG: String(initial.goals.proteinG),
      carbsG: String(initial.goals.carbsG), fatG: String(initial.goals.fatG), waterMl: String(initial.goals.waterMl),
    } : defaults,
  });
  const submit = handleSubmit(async (value) => onSubmit({
    name: value.name,
    dietaryPreference: value.dietaryPreference,
    allergies: value.allergiesText.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
    conditions: value.conditions,
    goals: { calories: Number(value.calories), proteinG: Number(value.proteinG), carbsG: Number(value.carbsG), fatG: Number(value.fatG), waterMl: Number(value.waterMl) },
  }));
  return <View style={styles.form}>
    <Controller control={control} name="name" render={({ field }) => <Input label="Name" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.name?.message} />} />
    <Body>Dietary preference</Body>
    <Controller control={control} name="dietaryPreference" render={({ field }) => <View style={styles.wrap}>
      {(["general", "vegetarian", "vegan"] as const).map((item) => <Chip key={item} label={item[0]!.toUpperCase() + item.slice(1)} selected={field.value === item} onPress={() => field.onChange(item)} />)}
    </View>} />
    <Controller control={control} name="allergiesText" render={({ field }) => <Input label="Allergies" placeholder="e.g. milk, peanut, gluten" value={field.value} onChangeText={field.onChange} />} />
    <Body>Conditions (optional)</Body>
    <Controller control={control} name="conditions" render={({ field }) => <View style={styles.wrap}>
      {([["type2-diabetes", "Type 2 diabetes"], ["hypertension", "Hypertension"], ["celiac", "Celiac"]] as const).map(([value, label]) => <Chip key={value} label={label} selected={field.value.includes(value)} onPress={() => field.onChange(field.value.includes(value) ? field.value.filter((item) => item !== value) : [...field.value, value])} />)}
    </View>} />
    <View style={styles.two}>
      <Controller control={control} name="calories" render={({ field }) => <Input label="Calories" keyboardType="numeric" value={field.value} onChangeText={field.onChange} style={styles.flex} />} />
      <Controller control={control} name="waterMl" render={({ field }) => <Input label="Water (ml)" keyboardType="numeric" value={field.value} onChangeText={field.onChange} style={styles.flex} />} />
    </View>
    <View style={styles.two}>
      <Controller control={control} name="proteinG" render={({ field }) => <Input label="Protein (g)" keyboardType="numeric" value={field.value} onChangeText={field.onChange} />} />
      <Controller control={control} name="carbsG" render={({ field }) => <Input label="Carbs (g)" keyboardType="numeric" value={field.value} onChangeText={field.onChange} />} />
      <Controller control={control} name="fatG" render={({ field }) => <Input label="Fat (g)" keyboardType="numeric" value={field.value} onChangeText={field.onChange} />} />
    </View>
    <Button label={isSubmitting ? "Saving…" : submitLabel} disabled={isSubmitting} onPress={submit} />
  </View>;
}
const styles = StyleSheet.create({ form: { gap: 16 }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, two: { flexDirection: "row", gap: 12 }, flex: { flex: 1 } });
