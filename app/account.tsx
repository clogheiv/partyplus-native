import { useState } from "react";
import { Pressable, ScrollView, TextInput } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "../components/themed-text";
import { supabase, isSupabaseConfigured, backendBoundary } from "../src/lib/supabase";
import { refreshHostParties } from "../src/data/hostRecovery";

export default function HostAccountScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verificationType, setVerificationType] = useState<"email" | "email_change" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Use your email to keep host access when you return on another device.");
  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      if (!isSupabaseConfigured) throw Error(backendBoundary.reason ?? "Backend is not configured.");
      if (!verificationType) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw Error("Enter a valid email address.");
        const { data } = await supabase.auth.getSession();
        const anonymous = data.session?.user.is_anonymous;
        // Linking an existing anonymous session preserves its guest principal.
        const response = anonymous
          ? await supabase.auth.updateUser({ email: email.trim() })
          : await supabase.auth.signInWithOtp({ email: email.trim() });
        if (response.error) throw response.error;
        setVerificationType(anonymous ? "email_change" : "email");
        setMessage("Check your email for the verification code. Enter it here to finish signing in.");
      } else {
        const response = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: verificationType });
        if (response.error) throw response.error;
        await refreshHostParties();
        setMessage("Signed in. Your verified host parties are available in Parties. Existing device parties stay preserved.");
        setCode("");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Account access could not be confirmed. Retry is available."); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 60 }} style={{ backgroundColor: "#08111f" }}>
    <ThemedText type="title">Host account</ThemedText>
    <ThemedText accessibilityLiveRegion="polite">{message}</ThemedText>
    <TextInput value={email} onChangeText={setEmail} editable={!verificationType && !busy} autoCapitalize="none" keyboardType="email-address"
      accessibilityLabel="Email address" placeholder="Email address" placeholderTextColor="#8ea4c5" style={{ color: "white", padding: 14, borderWidth: 1, borderColor: "#8ea4c5" }} />
    {verificationType ? <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" accessibilityLabel="Email verification code"
      placeholder="Verification code" placeholderTextColor="#8ea4c5" style={{ color: "white", padding: 14, borderWidth: 1, borderColor: "#8ea4c5" }} /> : null}
    <Pressable onPress={() => { void submit(); }} disabled={busy} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }}><ThemedText>{busy ? "Working…" : verificationType ? "Verify code" : "Send verification code"}</ThemedText></Pressable>
    <ThemedText>Older device-owned parties may need assisted recovery. A party ID or device UUID alone cannot grant host access.</ThemedText>
    <Pressable onPress={() => router.push("/load-parties")} accessibilityRole="button"><ThemedText>Open Parties</ThemedText></Pressable>
    <Pressable onPress={() => router.back()} accessibilityRole="button"><ThemedText>Return to draft</ThemedText></Pressable>
  </ScrollView>;
}
