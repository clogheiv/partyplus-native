import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { router } from "expo-router";
import { StyleSheet } from "react-native";

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">🎉 PartyPlus</ThemedText>
      <ThemedText type="subtitle">Less group-text chaos. More party.</ThemedText>

      <ThemedView style={styles.card}>
        <ThemedText type="defaultSemiBold">Quick actions</ThemedText>

        <ThemedView style={{ gap: 8 }}>
          <ThemedText onPress={() => router.push("/create-party")} style={styles.action}>
            ➕ Create Party
          </ThemedText>

          <ThemedText onPress={() => router.push("/load-parties")} style={styles.action}>
            📄 Load Parties
          </ThemedText>

          <ThemedText onPress={() => router.push("/share")} style={styles.action}>
            🔗 Share Link
          </ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText type="defaultSemiBold">Recent parties</ThemedText>
        <ThemedText style={{ opacity: 0.7 }}>
          Coming next: your Party list from the web version.
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    gap: 14,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(150,150,150,0.25)",
  },
  action: {
    fontSize: 16,
  },
});

