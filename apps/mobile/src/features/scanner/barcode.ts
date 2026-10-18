const digitsOnly = (value: string) => /^\d+$/.test(value);

function checkMod10(value: string): boolean {
  const digits = [...value].map(Number);
  const expected = digits.pop();
  if (expected === undefined) return false;
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === expected;
}

export function normalizeBarcode(value: string): string {
  const clean = value.replace(/[\s-]/g, "");
  return clean.length === 12 ? `0${clean}` : clean;
}

export function isValidBarcode(value: string): boolean {
  const clean = value.replace(/[\s-]/g, "");
  if (!digitsOnly(clean) || ![8, 12, 13].includes(clean.length)) return false;
  return checkMod10(clean);
}

export class StableBarcodeReader {
  private value = "";
  private count = 0;

  constructor(private readonly requiredFrames = 3) {}

  push(value: string): string | null {
    if (value === this.value) this.count += 1;
    else {
      this.value = value;
      this.count = 1;
    }
    return this.count >= this.requiredFrames && isValidBarcode(value) ? normalizeBarcode(value) : null;
  }

  reset() {
    this.value = "";
    this.count = 0;
  }
}
