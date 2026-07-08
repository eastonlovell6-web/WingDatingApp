import "react-native-url-polyfill/auto";

import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export async function uploadProfilePhoto(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`;
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const { error } = await supabase.storage
    .from("user-photos")
    .upload(path, bytes, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from("user-photos").getPublicUrl(path).data.publicUrl;
}

export async function upsertUserProfile(
  userId: string,
  fields: { name?: string; photos?: string[]; bio_prompts?: object[] }
) {
  const { error } = await supabase
    .from("users")
    .upsert({ id: userId, ...fields }, { onConflict: "id" });
  if (error) throw error;
}

export interface BioPrompt {
  question: string;
  answer: string;
}

export interface UserProfileRow {
  name: string | null;
  photos: string[] | null;
  bio_prompts: BioPrompt[] | null;
}

export async function getUserProfile(userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase
    .from("users")
    .select("name, photos, bio_prompts")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
