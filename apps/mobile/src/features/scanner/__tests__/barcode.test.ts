import { isValidBarcode, normalizeBarcode, StableBarcodeReader } from "../barcode";

describe("barcode validation", () => {
  it("validates EAN-13 and EAN-8 checksums", () => {
    expect(isValidBarcode("4006381333931")).toBe(true);
    expect(isValidBarcode("96385074")).toBe(true);
    expect(isValidBarcode("4006381333932")).toBe(false);
  });
  it("normalizes UPC-A to EAN-13", () => {
    expect(normalizeBarcode("036000291452")).toBe("0036000291452");
  });
  it("emits only after consecutive stable reads", () => {
    const reader = new StableBarcodeReader(3);
    expect(reader.push("4006381333931")).toBeNull();
    expect(reader.push("4006381333931")).toBeNull();
    expect(reader.push("4006381333931")).toBe("4006381333931");
  });
});
