declare module "react-native-mlkit-ocr" {
  type OcrBlock = { text: string };
  const MlkitOcr: { detectFromFile(path: string): Promise<OcrBlock[]> };
  export default MlkitOcr;
}
