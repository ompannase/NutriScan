import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert, StyleSheet, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, Chip, ScreenTitle } from "@/components/ui";
import { AccountPanel } from "@/features/auth/AccountPanel";
import { deleteAllLocalData, exportLocalData } from "@/database";
import { useSettingsStore, type ThemePreference, type UnitPreference } from "@/stores/settings";

export default function SettingsScreen() {
  const { theme, units, setTheme, setUnits, reset } = useSettingsStore();
  const exportData = async () => {
    const uri = `${FileSystem.cacheDirectory}nutriscan-export-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(await exportLocalData(), null, 2));
    await Sharing.shareAsync(uri, { mimeType: "application/json" });
  };
  const confirmDelete = () => Alert.alert("Delete all local data?", "This removes your profile, saved products, meals, water, and conversations from this device. A cloud copy, if you use sync, is kept: delete the account to remove it.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => void deleteAllLocalData().then(reset) },
  ]);
  return <AppScreen>
    <ScreenTitle>Settings</ScreenTitle>
    <Card><Body>Appearance</Body><View style={styles.wrap}>{(["system", "light", "dark"] as ThemePreference[]).map((value) => <Chip key={value} label={value[0]!.toUpperCase() + value.slice(1)} selected={theme === value} onPress={() => setTheme(value)} />)}</View></Card>
    <Card><Body>Units</Body><View style={styles.wrap}>{(["metric", "imperial"] as UnitPreference[]).map((value) => <Chip key={value} label={value[0]!.toUpperCase() + value.slice(1)} selected={units === value} onPress={() => setUnits(value)} />)}</View></Card>
    <AccountPanel />
    <Card><Body>Privacy</Body><Body muted>Profile, meal, scan, and conversation data is stored on this device. Product lookups go to Open Food Facts. If you connect a server, AI questions send only the message and the product or goal details you choose to share, and signed-in sync uploads your data to your own server. On-device OCR never uploads label images.</Body></Card>
    <Button label="Export local data as JSON" variant="secondary" onPress={() => void exportData()} />
    <Button label="Delete all local data" variant="danger" onPress={confirmDelete} />
    <Card><Body>Disclaimer</Body><Body muted>NutriScan is for educational dietary awareness and is not medical advice.</Body></Card>
    <Card><Body>About and attribution</Body><Body muted>NutriScan 1.0. Product data: Open Food Facts, available under the Open Database License. Images may have separate attribution requirements.</Body></Card>
  </AppScreen>;
}
const styles = StyleSheet.create({ wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 } });
