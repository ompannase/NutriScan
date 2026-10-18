export type DataOrigin = "api" | "user-entered" | "ocr-derived" | "inferred";
export type FieldState = "valid" | "missing" | "invalid" | DataOrigin;
export type DietaryPreference = "general" | "vegetarian" | "vegan";
export type Condition = "type2-diabetes" | "hypertension" | "celiac";

export type Nutrition = {
  energyKcal?: number;
  proteinG?: number;
  carbsG?: number;
  sugarsG?: number;
  fatG?: number;
  saturatedFatG?: number;
  fibreG?: number;
  sodiumMg?: number;
  saltG?: number;
};

export type Product = {
  id: string;
  barcode?: string;
  name: string;
  brand?: string;
  quantity?: string;
  imageUrl?: string;
  servingSizeG?: number;
  nutritionPer100: Nutrition;
  ingredients?: string;
  allergens: string[];
  traces: string[];
  labels: string[];
  novaGroup?: 1 | 2 | 3 | 4;
  source: "Open Food Facts" | "User-entered" | "OCR-derived";
  retrievedAt: string;
  origin: DataOrigin;
  verified: boolean;
};

export type UserProfile = {
  name: string;
  dietaryPreference: DietaryPreference;
  allergies: string[];
  conditions: Condition[];
  goals: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    waterMl: number;
  };
};

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type MealEntry = {
  id: string;
  productId: string;
  productName: string;
  meal: MealType;
  amountG: number;
  nutrition: Nutrition;
  date: string;
  approximate: boolean;
};
