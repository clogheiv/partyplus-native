import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { setCurrentPartyId } from "@/src/lib/partyStore";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, StyleSheet, View } from "react-native";

export default function PickActionScreen() {
  const params = useLocalSearchParams<{ id?: string; isHost?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const isHost = params.isHost === "true";

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText style={styles.eyebrow}>PARTYPLUS</ThemedText>
        <ThemedText type="title" style={styles.title}>
          Choose an action
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Open the party page, share the invite, or edit party details.
        </ThemedText>
      </View>

      <View style={styles.actions}>
      <Pressable
        onPress={() => {
          if (id) {
            router.push(`/party/${id}`);
            return;
          }

          router.push("/share");
        }}
        style={styles.primaryCard}
      >
        <ThemedText style={styles.primaryLabel}>OPEN</ThemedText>
        <ThemedText type="subtitle" style={styles.primaryTitle}>Join</ThemedText>
        <ThemedText style={styles.primaryBody}>
          Open the party page to RSVP and claim items
        </ThemedText>
      </Pressable>

      <Pressable
        onPress={async () => {
          if (!id) {
            router.push("/share");
            return;
          }

          await setCurrentPartyId(id);
          router.push("/share");
        }}
        style={styles.secondaryCard}
      >
        <ThemedText style={styles.secondaryLabel}>SEND</ThemedText>
        <ThemedText type="subtitle" style={styles.secondaryTitle}>
          Share
        </ThemedText>
        <ThemedText style={styles.secondaryBody}>Copy or send this invite</ThemedText>
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

        style={styles.secondaryCard}
      >
        <ThemedText style={styles.secondaryLabel}>HOST</ThemedText>
        <ThemedText type="subtitle" style={styles.secondaryTitle}>
          Edit
        </ThemedText>
        <ThemedText style={styles.secondaryBody}>Change details and items</ThemedText>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <ThemedText style={styles.backText}>Back</ThemedText>
      </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: "center",
    backgroundColor: "#08111f",
  },
  header: {
    gap: 7,
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#ff9f87",
  },
  title: {
    color: "#f6efe7",
  },
  subtitle: {
    color: "#afbdd5",
  },
  actions: {
    gap: 14,
  },
  primaryCard: {
    borderWidth: 1,
    borderColor: "#2f61f3",
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#2f61f3",
    gap: 6,
    shadowColor: "#17379c",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  primaryLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.74)",
  },
  primaryTitle: {
    color: "#fff",
  },
  primaryBody: {
    color: "rgba(255,255,255,0.84)",
  },
  secondaryCard: {
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 24,
    padding: 18,
    gap: 6,
    backgroundColor: "#101a2b",
    shadowColor: "#020617",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  secondaryLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#ff9f87",
  },
  secondaryTitle: {
    color: "#f6efe7",
  },
  secondaryBody: {
    color: "#afbdd5",
  },
  backButton: {
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 18,
    padding: 15,
    opacity: 0.9,
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "#101a2b",
  },
  backText: {
    color: "#dfe7f5",
    fontWeight: "600",
  },
});
