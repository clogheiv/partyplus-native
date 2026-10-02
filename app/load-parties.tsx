import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

import { refreshHostParties } from "../src/data/hostRecovery";
import { offerHostTools } from "../src/lib/hostAccess";
import { classifyPartyError } from "../src/lib/partyErrors";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setLoadError(null);
    setRefreshWarning(null);
    try {
      try { await refreshHostParties(); }
      catch (error) {
        if (request === generation.current) setRefreshWarning("Showing saved parties. Account refresh failed: " + classifyPartyError(error).message);
      }
      const localParties = await getParties();
      const sorted = [...localParties].sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
      );
      if (request === generation.current) setParties(sorted);
    } catch (error) {
      if (request === generation.current) setLoadError(classifyPartyError(error).message);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => { generation.current++; };
    }, [load])
  );

  async function openParty(p: Party) {
    try {
    await setCurrentPartyId(p.id);
    const isHost = await offerHostTools(p);
    router.push(`/pick-action?id=${p.id}&isHost=${isHost ? "true" : "false"}`);
    } catch (error) { Alert.alert("Could not open party", classifyPartyError(error).message); }
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

      <Pressable onPress={() => router.push("/account")} accessibilityRole="button"><ThemedText>Host account and recovery</ThemedText></Pressable>
      {!!refreshWarning && !loading && (
        <View accessibilityRole="alert">
          <ThemedText style={styles.subtitle}>{refreshWarning}</ThemedText>
          <Pressable onPress={load} accessibilityRole="button"><ThemedText>Retry account refresh</ThemedText></Pressable>
        </View>
      )}
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
            {loadError}
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
