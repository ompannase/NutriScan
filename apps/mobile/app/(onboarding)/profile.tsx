import { router } from "expo-router";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, ScreenTitle } from "@/components/ui";
import { profileRepository } from "@/database/repositories";
import { ProfileForm } from "@/features/profile/ProfileForm";
import { useSettingsStore } from "@/stores/settings";

export default function ProfileSetupScreen() {
  const finish = useSettingsStore((state) => state.finishOnboarding);
  const done = () => { finish(); router.replace("/(tabs)/home"); };
  return <AppScreen>
    <ScreenTitle eyebrow="Personal context">Make results useful to you</ScreenTitle>
    <Body muted>Everything here stays on this device. You can change it later.</Body>
    <ProfileForm submitLabel="Save and continue" onSubmit={async (profile) => { await profileRepository.save(profile); done(); }} />
    <Button label="Continue as guest" variant="secondary" onPress={done} />
    <Button label="Sign in" variant="secondary" onPress={() => router.push("/(onboarding)/sign-in")} />
  </AppScreen>;
}
