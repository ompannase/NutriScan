import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import MlkitOcr from "react-native-mlkit-ocr";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Chip, Input, ScreenTitle, Sheet } from "@/components/ui";
import { StableBarcodeReader, isValidBarcode, normalizeBarcode } from "@/features/scanner/barcode";
import { useTheme } from "@/theme";

type Mode = "barcode" | "label";

export default function ScanScreen() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>("barcode");
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(true);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState("");
  const camera = useRef<CameraView>(null);
  const reader = useRef(new StableBarcodeReader(3));
  useFocusEffect(useCallback(() => { setActive(true); return () => setActive(false); }, []));

  const onBarcode = async ({ data }: BarcodeScanningResult) => {
    if (busy) return;
    const stable = reader.current.push(data);
    if (!stable) return;
    setBusy(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push(`/product/${stable}`);
    setTimeout(() => { setBusy(false); reader.current.reset(); }, 1000);
  };

  const processPhoto = async (uri: string, width?: number, height?: number) => {
    if ((width ?? 1000) < 600 || (height ?? 1000) < 600) return;
    setBusy(true);
    try {
      const fixed = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG });
      const blocks = await MlkitOcr.detectFromFile(fixed.uri);
      router.push({ pathname: "/ocr-review", params: { text: blocks.map((block) => block.text).join("\n") } });
    } finally { setBusy(false); }
  };

  const capture = async () => {
    const photo = await camera.current?.takePictureAsync({ quality: 0.9 });
    if (photo) await processPhoto(photo.uri, photo.width, photo.height);
  };
  const gallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    const asset = result.assets?.[0];
    if (asset) await processPhoto(asset.uri, asset.width, asset.height);
  };
  const submitManual = () => {
    if (!isValidBarcode(manual)) return;
    setManualOpen(false);
    router.push(`/product/${normalizeBarcode(manual)}`);
  };

  if (!permission) return <AppScreen><Body>Checking camera access…</Body></AppScreen>;
  if (!permission.granted) return <AppScreen>
    <ScreenTitle>Scan food labels</ScreenTitle>
    <Body>Camera access lets NutriScan read a barcode or a nutrition label. Nothing is uploaded for local label recognition.</Body>
    {permission.canAskAgain ? <Button label="Allow camera access" onPress={() => void requestPermission()} /> : <Button label="Open settings" onPress={() => void Linking.openSettings()} />}
    <Button label="Enter barcode manually" variant="secondary" onPress={() => setManualOpen(true)} />
    <ManualSheet visible={manualOpen} value={manual} setValue={setManual} submit={submitManual} close={() => setManualOpen(false)} />
  </AppScreen>;

  return <View style={[styles.page, { backgroundColor: colors.background }]}>
    {active ? <CameraView
      ref={camera}
      style={StyleSheet.absoluteFill}
      facing="back"
      enableTorch={torch}
      barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
      onBarcodeScanned={mode === "barcode" && !busy ? onBarcode : undefined}
    /> : null}
    <View style={styles.overlay}>
      <View style={[styles.segment, { backgroundColor: colors.surface }]}>
        <Chip label="Barcode" selected={mode === "barcode"} onPress={() => setMode("barcode")} />
        <Chip label="Label" selected={mode === "label"} onPress={() => setMode("label")} />
      </View>
      <View style={[styles.frame, { borderColor: colors.inverse }]}>
        <Text style={[styles.hint, { color: colors.inverse }]}>{busy ? "Reading…" : mode === "barcode" ? "Hold steady inside the frame" : "Fill the frame with the nutrition label"}</Text>
      </View>
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Toggle torch" onPress={() => setTorch(!torch)} style={[styles.circle, { backgroundColor: colors.surface }]}><Ionicons name={torch ? "flash" : "flash-off"} size={22} color={colors.text} /></Pressable>
        {mode === "label" ? <Pressable accessibilityRole="button" accessibilityLabel="Capture label photo" disabled={busy} onPress={() => void capture()} style={[styles.shutter, { borderColor: colors.inverse }]} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={mode === "label" ? "Choose label photo" : "Enter barcode manually"} onPress={() => mode === "label" ? void gallery() : setManualOpen(true)} style={[styles.circle, { backgroundColor: colors.surface }]}><Ionicons name={mode === "label" ? "images-outline" : "keypad-outline"} size={22} color={colors.text} /></Pressable>
      </View>
    </View>
    <ManualSheet visible={manualOpen} value={manual} setValue={setManual} submit={submitManual} close={() => setManualOpen(false)} />
  </View>;
}

function ManualSheet({ visible, value, setValue, submit, close }: { visible: boolean; value: string; setValue: (value: string) => void; submit: () => void; close: () => void }) {
  return <Sheet visible={visible} title="Enter barcode" onClose={close}>
    <Input label="EAN or UPC" value={value} keyboardType="number-pad" onChangeText={setValue} error={value && !isValidBarcode(value) ? "Check the barcode digits" : undefined} />
    <Button label="Find product" disabled={!isValidBarcode(value)} onPress={submit} />
  </Sheet>;
}
const styles = StyleSheet.create({
  page: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, padding: 24, paddingTop: 72, justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(0,0,0,0.22)" },
  segment: { flexDirection: "row", padding: 4, borderRadius: 999, gap: 4 },
  frame: { width: "100%", height: 240, borderWidth: 2, borderRadius: 24, alignItems: "center", justifyContent: "flex-end", padding: 16 },
  hint: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  controls: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingBottom: 20 },
  circle: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 6, backgroundColor: "#FFFFFF" },
});
