import { router } from "expo-router";
import { AppScreen } from "@/components/AppScreen";
import { Button, ScreenTitle } from "@/components/ui";
import { API_BASE_URL } from "@/config";
import { AccountFlow } from "@/features/auth/AccountFlow";
import { useSettingsStore } from "@/stores/settings";

export default function SignInScreen() {
  const finish = useSettingsStore((state) => state.finishOnboarding);
  const done = () => { finish(); router.replace("/(tabs)/home"); };
  return <AppScreen>
    <ScreenTitle>Sync (optional)</ScreenTitle>
    {API_BASE_URL ? <AccountFlow onDone={done} /> : null}
    <Button label="Continue offline" variant="secondary" onPress={done} />
  </AppScreen>;
}
