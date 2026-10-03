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
  const [verified, setVerified] = useState(false);
  const [linkPrincipal, setLinkPrincipal] = useState<string | null>(null);
  const [message, setMessage] = useState("Use your email to keep host access when you return on another device.");
  async function submit(resend = false) {
    if (busy) return;
    setBusy(true);
    try {
      if (!isSupabaseConfigured) throw Error(backendBoundary.reason ?? "Backend is not configured.");
      if (verified) {
        await refreshHostParties();
        setMessage("Your verified host parties are available in Parties.");
      } else if (!verificationType || resend) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw Error("Enter a valid email address.");
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const anonymous = data.session?.user.is_anonymous;
        // Linking an existing anonymous session preserves its guest principal.
        const response = anonymous
          ? await supabase.auth.updateUser({ email: email.trim() })
          : await supabase.auth.signInWithOtp({ email: email.trim() });
        if (response.error) throw response.error;
        setLinkPrincipal(anonymous ? data.session!.user.id : null);
        setVerificationType(anonymous ? "email_change" : "email");
        setMessage("Check your email for the verification code. Enter it here to finish signing in.");
      } else {
        // Supabase supports configured email codes from six to ten digits.
        // The server still verifies the exact code, expiry and one-time use.
        if (!/^\d{6,10}$/.test(code.trim())) throw Error("Enter the verification code from your email (6–10 digits).");
        const response = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: verificationType });
        if (response.error) throw response.error;
        const user = response.data.user;
        if (!user || user.is_anonymous || !user.email_confirmed_at || (linkPrincipal && user.id !== linkPrincipal)) {
          throw Error("Verified account access could not be confirmed. Your local parties remain preserved.");
        }
        // The one-time code is consumed even if loading host parties then fails.
        setVerified(true);
        setVerificationType(null);
        setCode("");
        await refreshHostParties();
        setMessage("Signed in. Your verified host parties are available in Parties. Existing device parties stay preserved.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Account access could not be confirmed. Retry is available."); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 60 }} style={{ backgroundColor: "#08111f" }}>
    <ThemedText type="title">Host account</ThemedText>
    <ThemedText accessibilityLiveRegion="polite">{message}</ThemedText>
    <TextInput value={email} onChangeText={setEmail} editable={!verificationType && !busy && !verified} autoCapitalize="none" keyboardType="email-address"
      accessibilityLabel="Email address" placeholder="Email address" placeholderTextColor="#8ea4c5" style={{ color: "white", padding: 14, borderWidth: 1, borderColor: "#8ea4c5" }} />
    {verificationType ? <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" accessibilityLabel="Email verification code"
      placeholder="Verification code" placeholderTextColor="#8ea4c5" style={{ color: "white", padding: 14, borderWidth: 1, borderColor: "#8ea4c5" }} /> : null}
    <Pressable onPress={() => { void submit(); }} disabled={busy} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }}><ThemedText>{busy ? "Working…" : verified ? "Reload host parties" : verificationType ? "Verify code" : "Send verification code"}</ThemedText></Pressable>
    {verificationType ? <>
      <Pressable onPress={() => { void submit(true); }} disabled={busy} accessibilityRole="button"><ThemedText>Resend code</ThemedText></Pressable>
      <Pressable onPress={() => { setVerificationType(null); setLinkPrincipal(null); setCode(""); setMessage("Enter your email to request a new code. Your existing session and parties remain preserved."); }} disabled={busy} accessibilityRole="button"><ThemedText>Use a different email</ThemedText></Pressable>
    </> : null}
    <ThemedText>Older device-owned parties may need assisted recovery. A party ID or device UUID alone cannot grant host access.</ThemedText>
    <Pressable onPress={() => router.push("/load-parties")} accessibilityRole="button"><ThemedText>Open Parties</ThemedText></Pressable>
    <Pressable onPress={() => router.back()} accessibilityRole="button"><ThemedText>Return to draft</ThemedText></Pressable>
  </ScrollView>;
}
