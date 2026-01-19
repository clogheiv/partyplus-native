import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function HomeScreen() {
  return (
    <ThemedView style={{ flex: 1, padding: 20, gap: 14, justifyContent: "center" }}>
      <ThemedText type="title">PartyPlus</ThemedText>
      <ThemedText type="subtitle">What do you want to do?</ThemedText>

      <Pressable
        onPress={() => router.push("/create-party")}
        style={{
          borderWidth: 1,
          borderRadius: 14,
          padding: 14,
          marginTop: 10,
        }}
      >
        <ThemedText type="subtitle">Create a Party</ThemedText>
      </Pressable>

      <Pressable
        onPress={() => router.push("/load-parties")}
        style={{
          borderWidth: 1,
          borderRadius: 14,
          padding: 14,
        }}
      >
        <ThemedText type="subtitle">Pick a Party</ThemedText>
      </Pressable>

      <View style={{ height: 10 }} />
      <ThemedText style={{ opacity: 0.7 }}>
        Tip: “Pick a Party” lets you join/share/edit from an existing party.
      </ThemedText>
    </ThemedView>
  );
}
