import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable } from "react-native";

export default function PickActionScreen() {
  const params = useLocalSearchParams<{ id?: string; isHost?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const isHost = params.isHost === "true";

  return (
    <ThemedView style={{ flex: 1, padding: 20, gap: 14, justifyContent: "center" }}>
      <ThemedText type="title">What do you want to do?</ThemedText>

      <Pressable
        onPress={() => router.push("/share")}
        style={{ borderWidth: 1, borderRadius: 14, padding: 14 }}
      >
        <ThemedText type="subtitle">Join</ThemedText>
        <ThemedText style={{ opacity: 0.7 }}>Claim items and share with others</ThemedText>
      </Pressable>

      <Pressable
       onPress={() => {
  if (!id) return;

  if (!isHost) {
    Alert.alert("Host only", "Only the party host can edit this party.");
    return;
  }

  router.push(`/create-party?id=${id}`);
}}

        style={{ borderWidth: 1, borderRadius: 14, padding: 14 }}
      >
        <ThemedText type="subtitle">Edit</ThemedText>
        <ThemedText style={{ opacity: 0.7 }}>Change details and items</ThemedText>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={{ borderWidth: 1, borderRadius: 14, padding: 14, opacity: 0.8 }}
      >
        <ThemedText>Back</ThemedText>
      </Pressable>
    </ThemedView>
  );
}
