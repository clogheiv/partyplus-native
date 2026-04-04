import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://example.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "example-publishable-key";

function getEnvValue(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const supabaseUrl = getEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = getEnvValue(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl ?? FALLBACK_SUPABASE_URL,
  supabaseAnonKey ?? FALLBACK_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
