import { Redirect } from "expo-router";
import { useSettingsStore } from "@/stores/settings";

export default function Index() {
  const complete = useSettingsStore((state) => state.onboardingComplete);
  return <Redirect href={complete ? "/(tabs)/home" : "/(onboarding)"} />;
}
