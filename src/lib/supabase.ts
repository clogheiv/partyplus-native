import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const FALLBACK_SUPABASE_URL = "https://example.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "example-publishable-key";

function getEnvValue(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const supabaseUrl = getEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = getEnvValue(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const canPersistAuthSession = Platform.OS !== "web" || typeof window !== "undefined";

export const supabase = createClient(
  supabaseUrl ?? FALLBACK_SUPABASE_URL,
  supabaseAnonKey ?? FALLBACK_SUPABASE_ANON_KEY,
  {
    auth: {
      ...(canPersistAuthSession ? { storage: AsyncStorage } : {}),
      autoRefreshToken: canPersistAuthSession,
      persistSession: canPersistAuthSession,
      detectSessionInUrl: false,
    },
  }
);
