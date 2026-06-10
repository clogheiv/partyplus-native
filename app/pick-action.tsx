import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteRemoteParty } from "@/src/data/parties";
import { deletePartyById, setCurrentPartyId } from "@/src/lib/partyStore";
import { isSupabaseConfigured } from "@/src/lib/supabase";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PickActionScreen() {
  const params = useLocalSearchParams<{ id?: string; isHost?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const isHost = params.isHost === "true";
  const [deletingParty, setDeletingParty] = useState(false);
  const insets = useSafeAreaInsets();

  async function handleDeleteParty() {
    if (!id || deletingParty) return;
    if (!isHost) {
      Alert.alert("Host only", "Only the party host can delete this party.");
      return;
    }

    setDeletingParty(true);
    try {
      if (isSupabaseConfigured) {
        await deleteRemoteParty(id);
      }

      await deletePartyById(id);

      const raw = await AsyncStorage.getItem("hostPartyIds");
      const parsedHostIds = raw ? JSON.parse(raw) : [];
      const hostIds: string[] = Array.isArray(parsedHostIds) ? parsedHostIds : [];
      const nextHostIds = hostIds.filter((entry) => entry !== id);
      if (nextHostIds.length !== hostIds.length) {
        await AsyncStorage.setItem("hostPartyIds", JSON.stringify(nextHostIds));
      }

      router.replace("/");
    } catch {
      Alert.alert("Delete failed", "Could not delete this party.");
    } finally {
      setDeletingParty(false);
    }
  }

  function confirmDeleteParty() {
    Alert.alert(
      "Delete party?",
      "This will permanently remove this party.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void handleDeleteParty();
          },
        },
      ]
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
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

        {isHost ? (
          <Pressable
            onPress={confirmDeleteParty}
            disabled={deletingParty}
            style={[styles.dangerCard, deletingParty ? styles.cardDisabled : null]}
          >
            <ThemedText style={styles.dangerLabel}>HOST</ThemedText>
            <ThemedText type="subtitle" style={styles.dangerTitle}>
              {deletingParty ? "Deleting..." : "Delete Party"}
            </ThemedText>
            <ThemedText style={styles.dangerBody}>Remove this party permanently</ThemedText>
          </Pressable>
        ) : null}

        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#08111f",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
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
  dangerCard: {
    borderWidth: 1,
    borderColor: "#b42318",
    borderRadius: 24,
    padding: 18,
    gap: 6,
    backgroundColor: "#5f1515",
    shadowColor: "#020617",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  dangerLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#ffe4e1",
  },
  dangerTitle: {
    color: "#fff",
  },
  dangerBody: {
    color: "#ffe4e1",
  },
  cardDisabled: {
    opacity: 0.65,
  },
});
