import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

import { ensureUserId } from "../src/lib/ids";
import { getParties, setCurrentPartyId } from "../src/lib/partyStore";
import type { Party } from "../src/lib/partyTypes";

function formatWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function LoadPartiesScreen() {
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<Party[]>([]);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const localParties = await getParties();
      const sorted = [...localParties].sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
      );
      setParties(sorted);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function openParty(p: Party) {
    await setCurrentPartyId(p.id);
    const storedUserId = await ensureUserId();
    const isHost = !!storedUserId && p.hostId === storedUserId;
    router.push(`/pick-action?id=${p.id}&isHost=${isHost ? "true" : "false"}`);
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText style={styles.eyebrow}>PARTYPLUS</ThemedText>
        <ThemedText type="title" style={styles.title}>
          Parties
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Choose a party to open it, share the invite, or edit it.
        </ThemedText>
      </View>

      {loading ? (
        <ThemedView
          style={styles.loadingWrap}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading saved parties"
        >
          <ActivityIndicator />
        </ThemedView>
      ) : loadError ? (
        <ThemedView style={styles.emptyCard} accessibilityRole="alert">
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            Could not load your parties.
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Your saved parties are still on this device. Try loading them again.
          </ThemedText>
          <Pressable
            onPress={load}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel="Retry loading saved parties"
          >
            <ThemedText type="subtitle" style={styles.primaryButtonText}>
              Try Again
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : parties.length === 0 ? (
        <ThemedView style={styles.emptyCard}>
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No saved parties yet.
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Create one first, then come back here to open it.
          </ThemedText>

          <Pressable
            onPress={() => router.push("/create-party")}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel="Create a party"
          >
            <ThemedText type="subtitle" style={styles.primaryButtonText}>
              Create Party
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 34, paddingTop: 4 }}>
          {parties.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => openParty(p)}
              style={styles.partyCard}
              accessibilityRole="button"
              accessibilityLabel={`Open ${p.title}`}
              accessibilityHint="Shows actions for this saved party"
            >
              <View style={styles.partyCardHeader}>
                <ThemedText style={styles.partyCardEyebrow}>
                  SAVED PARTY
                </ThemedText>
                <ThemedText type="subtitle" style={styles.partyCardTitle}>
                  {p.title}
                </ThemedText>
              </View>

              {!!p.location && (
                <ThemedText style={styles.partyCardMeta}>Location: {p.location}</ThemedText>
              )}

              <ThemedText style={styles.partyCardMeta}>
                Date & Time: {p.date ? formatWhen(p.date) : "Not set"}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 14,
    backgroundColor: "#08111f",
  },
  header: {
    gap: 7,
    marginBottom: 4,
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
  loadingWrap: {
    paddingTop: 28,
  },
  emptyCard: {
    gap: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 24,
    backgroundColor: "#101a2b",
    marginTop: 8,
    shadowColor: "#020617",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  emptyTitle: {
    color: "#f6efe7",
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: "#2f61f3",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#2f61f3",
  },
  primaryButtonText: {
    color: "#f6efe7",
  },
  partyCard: {
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 24,
    padding: 18,
    gap: 10,
    backgroundColor: "#101a2b",
    shadowColor: "#020617",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  partyCardHeader: {
    gap: 3,
  },
  partyCardEyebrow: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ff9f87",
  },
  partyCardTitle: {
    color: "#f6efe7",
  },
  partyCardMeta: {
    color: "#afbdd5",
    lineHeight: 20,
  },
});
