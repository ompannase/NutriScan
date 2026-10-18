import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { router, useLocalSearchParams } from "expo-router";
import { z } from "zod";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Input, ScreenTitle } from "@/components/ui";
import { productRepository } from "@/database/repositories";
import { createId } from "@/utils/id";

const schema = z.object({
  name: z.string().min(1, "Enter a product name"),
  brand: z.string(),
  energyKcal: z.string(),
  proteinG: z.string(),
  carbsG: z.string(),
  fatG: z.string(),
  ingredients: z.string(),
});
type Values = z.infer<typeof schema>;

export default function CustomProductScreen() {
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  const { control, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", brand: "", ingredients: "", energyKcal: "", proteinG: "", carbsG: "", fatG: "" } });
  const save = handleSubmit(async (values) => {
    const id = `custom:${createId()}`;
    await productRepository.save({
      id, barcode, name: values.name, brand: values.brand || undefined, ingredients: values.ingredients || undefined,
      nutritionPer100: {
        energyKcal: values.energyKcal ? Number(values.energyKcal) : undefined,
        proteinG: values.proteinG ? Number(values.proteinG) : undefined,
        carbsG: values.carbsG ? Number(values.carbsG) : undefined,
        fatG: values.fatG ? Number(values.fatG) : undefined,
      },
      allergens: [], traces: [], labels: [], source: "User-entered", retrievedAt: new Date().toISOString(), origin: "user-entered", verified: false,
    });
    if (barcode) router.replace(`/product/${barcode}`); else router.back();
  });
  return <AppScreen>
    <ScreenTitle>Manual nutrition entry</ScreenTitle>
    <Body muted>Enter values exactly as printed per 100 g/ml. This product will be marked unverified.</Body>
    <Controller control={control} name="name" render={({ field }) => <Input label="Product name" value={field.value} onChangeText={field.onChange} error={errors.name?.message} />} />
    <Controller control={control} name="brand" render={({ field }) => <Input label="Brand (optional)" value={field.value} onChangeText={field.onChange} />} />
    {(["energyKcal", "proteinG", "carbsG", "fatG"] as const).map((name) => <Controller key={name} control={control} name={name} render={({ field }) => <Input label={({ energyKcal: "Energy (kcal)", proteinG: "Protein (g)", carbsG: "Carbohydrate (g)", fatG: "Fat (g)" })[name]} keyboardType="decimal-pad" value={field.value} onChangeText={field.onChange} />} />)}
    <Controller control={control} name="ingredients" render={({ field }) => <Input label="Ingredients (optional)" multiline value={field.value} onChangeText={field.onChange} />} />
    <Button label="Save unverified product" onPress={save} />
  </AppScreen>;
}
