import { router } from "expo-router";
import { Pressable } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function HomeScreen() {
  return (
    <ThemedView style={{ flex: 1, padding: 20, gap: 16, justifyContent: "center" }}>
      <ThemedText type="title">PartyPlus</ThemedText>
      <ThemedText type="subtitle">Less group-text chaos. More party.</ThemedText>

      <Pressable
        onPress={() => router.push("/load-parties")}
        style={{
          borderWidth: 1,
          borderRadius: 14,
          padding: 14,
          marginTop: 12,
        }}
      >
        <ThemedText type="subtitle">Parties</ThemedText>
      </Pressable>

      <Pressable
        onPress={() => router.push("/create-party")}
        style={{
          borderWidth: 1,
          borderRadius: 14,
          padding: 14,
        }}
      >
        <ThemedText type="subtitle">Create Party</ThemedText>
      </Pressable>
    </ThemedView>
  );
}
