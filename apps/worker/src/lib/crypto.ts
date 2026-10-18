const encoder = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  for (const byte of raw) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Crockford base32 (no I, L, O, U). 256 is a multiple of 32, so `byte & 31` is unbiased.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const KEY_LENGTH = 24; // 24 chars x 5 bits = 120 bits of entropy

export function generateAccountKey(): string {
  const raw = crypto.getRandomValues(new Uint8Array(KEY_LENGTH));
  return [...raw].map((b) => ALPHABET[b & 31]).join("");
}

export function formatAccountKey(key: string): string {
  return key.match(/.{1,4}/g)!.join("-");
}

/** Normalises user-typed keys (case, hyphens, spaces, look-alike characters). */
export function normalizeAccountKey(raw: string): string | null {
  const cleaned = raw
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return /^[0-9A-HJKMNP-TV-Z]{24}$/.test(cleaned) ? cleaned : null;
}

export function hashAccountKey(normalizedKey: string): Promise<string> {
  return sha256Hex(`nutriscan:account-key:v1:${normalizedKey}`);
}

export const nowIso = () => new Date().toISOString();
