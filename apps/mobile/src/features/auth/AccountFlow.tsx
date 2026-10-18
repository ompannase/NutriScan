import { useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Input } from "@/components/ui";
import { authService } from "@/services/auth";
import { useTheme } from "@/theme";

type Mode = "choose" | "signin" | "key";

/** Create a sync account (shows the one-time key) or sign in with an existing key. */
export function AccountFlow({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [typedKey, setTypedKey] = useState("");
  const [issuedKey, setIssuedKey] = useState("");
  const [saved, setSaved] = useState(false);

  const create = async () => {
    setBusy(true); setError(undefined);
    const result = await authService.register();
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setIssuedKey(result.data.accountKey); setMode("key");
  };
  const signIn = async () => {
    setBusy(true); setError(undefined);
    const result = await authService.signIn(typedKey);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone();
  };

  if (mode === "key") {
    return <View style={styles.gap}>
      <Card>
        <Body>Your account key</Body>
        <Text selectable accessibilityLabel={`Account key ${issuedKey}`} style={[styles.key, { color: colors.text }]}>{issuedKey}</Text>
        <Body muted>This key is your login. It is shown only once and can't be recovered, so store it in a password manager or somewhere safe.</Body>
      </Card>
      <Button label="Share or copy key" variant="secondary" onPress={() => void Share.share({ message: issuedKey })} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: saved }} accessibilityLabel="I have saved my account key" onPress={() => setSaved(!saved)} style={styles.checkRow}>
        <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: saved ? colors.primary : colors.surface }]}>
          <Text style={{ color: colors.inverse }}>{saved ? "✓" : ""}</Text>
        </View>
        <Body>I've saved my key.</Body>
      </Pressable>
      <Button label="Done" disabled={!saved} onPress={onDone} />
    </View>;
  }

  if (mode === "signin") {
    return <View style={styles.gap}>
      <Input label="Account key" value={typedKey} onChangeText={setTypedKey} autoCapitalize="characters" autoCorrect={false} autoComplete="off" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" error={error} />
      <Body muted>Anything already stored on this device is merged into this account, newest edit wins.</Body>
      <Button label={busy ? "Signing in…" : "Sign in"} disabled={busy || typedKey.trim().length < 8} onPress={() => void signIn()} />
      <Button label="Back" variant="secondary" onPress={() => { setMode("choose"); setError(undefined); }} />
    </View>;
  }

  return <View style={styles.gap}>
    <Card>
      <Body>Sync across devices (optional)</Body>
      <Body muted>No email or password. You get a private account key that restores your data on another phone. NutriScan keeps working fully offline without an account.</Body>
    </Card>
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
    <Button label={busy ? "Creating…" : "Create sync account"} disabled={busy} onPress={() => void create()} />
    <Button label="I already have a key" variant="secondary" onPress={() => setMode("signin")} />
  </View>;
}

const styles = StyleSheet.create({
  gap: { gap: 16 },
  key: { fontSize: 20, fontWeight: "800", letterSpacing: 1, paddingVertical: 8 },
  checkRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
