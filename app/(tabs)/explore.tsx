import { router } from "expo-router";
import { Pressable } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function HomeScreen() {
  return (
    <ThemedView style={{ flex: 1, padding: 20, gap: 14, justifyContent: "center" }}>
      <ThemedText type="title">PartyPlus</ThemedText>
      <ThemedText type="subtitle">Choose an existing party</ThemedText>

      <Pressable
        onPress={() => router.push("/load-parties")}
        style={{
          borderWidth: 1,
          borderRadius: 14,
          padding: 14,
          marginTop: 10,
        }}
      >
        <ThemedText type="subtitle">Pick a Party</ThemedText>
      </Pressable>

      <ThemedText style={{ opacity: 0.7 }}>
        Pick a party to join it, edit it, or share its invite.
      </ThemedText>
    </ThemedView>
  );
}
