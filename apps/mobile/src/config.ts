/**
 * Public, non-secret configuration. EXPO_PUBLIC_* values are embedded in the app bundle,
 * so this must only ever hold an origin URL, never a key.
 */
const raw = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
export const API_BASE_URL: string | undefined = raw.length > 0 ? raw : undefined;
export const OPEN_FOOD_FACTS_CONTACT = (process.env.EXPO_PUBLIC_OFF_CONTACT ?? "").trim() || "mobile-app-contact@example.invalid";
