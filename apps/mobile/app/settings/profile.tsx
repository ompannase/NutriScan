import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppScreen } from "@/components/AppScreen";
import { Loading, ScreenTitle } from "@/components/ui";
import { profileRepository } from "@/database/repositories";
import { ProfileForm } from "@/features/profile/ProfileForm";

export default function EditProfileScreen() {
  const profile = useQuery({ queryKey: ["profile"], queryFn: profileRepository.get });
  if (profile.isLoading) return <AppScreen><Loading /></AppScreen>;
  return <AppScreen><ScreenTitle>Profile and goals</ScreenTitle><ProfileForm initial={profile.data ?? undefined} submitLabel="Save changes" onSubmit={async (value) => { await profileRepository.save(value); router.back(); }} /></AppScreen>;
}
