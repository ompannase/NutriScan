import { router } from "expo-router";
import { AppScreen } from "@/components/AppScreen";
import { ScreenTitle } from "@/components/ui";
import { AccountFlow } from "@/features/auth/AccountFlow";

export default function AccountScreen() {
  return <AppScreen>
    <ScreenTitle eyebrow="Optional">Sync your data</ScreenTitle>
    <AccountFlow onDone={() => router.back()} />
  </AppScreen>;
}
