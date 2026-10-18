import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppScreen } from "@/components/AppScreen";
import { Body, Button, Card, EmptyState, ScreenTitle } from "@/components/ui";
import { profileRepository } from "@/database/repositories";
import type { UserProfile } from "@/types/models";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  useFocusEffect(useCallback(() => { void profileRepository.get().then(setProfile); }, []));
  return <AppScreen>
    <ScreenTitle eyebrow="Local profile">{profile?.name ?? "Guest"}</ScreenTitle>
    {profile ? <>
      <Card><Body>Dietary preference</Body><Body muted>{profile.dietaryPreference}</Body></Card>
      <Card><Body>Allergies</Body><Body muted>{profile.allergies.length ? profile.allergies.join(", ") : "None added"}</Body></Card>
      <Card><Body>Conditions</Body><Body muted>{profile.conditions.length ? profile.conditions.join(", ") : "None added"}</Body></Card>
      <Button label="Edit profile and goals" onPress={() => router.push("/settings/profile")} />
    </> : <EmptyState title="No profile details" message="You're using NutriScan as a guest. Add a profile for personalized context." action={<Button label="Set up profile" onPress={() => router.push("/settings/profile")} />} />}
    <Button label="Settings and privacy" variant="secondary" onPress={() => router.push("/settings")} />
  </AppScreen>;
}
