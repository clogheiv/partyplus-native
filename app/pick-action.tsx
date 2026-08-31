import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createRemoteParty, deleteRemoteParty } from "@/src/data/parties";
import { buildDuplicateParty } from "@/src/lib/duplicateParty";
import { ensureUserId } from "@/src/lib/ids";
import { sharePartyReminder } from "@/src/lib/inviteShare";
import { deletePartyById, getPartyById, setCurrentPartyId, upsertParty } from "@/src/lib/partyStore";
import type { Party } from "@/src/lib/partyTypes";
import { isSupabaseConfigured } from "@/src/lib/supabase";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PickActionScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfirmedHost, setIsConfirmedHost] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [duplicatingParty, setDuplicatingParty] = useState(false);
  const [deletingParty, setDeletingParty] = useState(false);
  const sendingReminderRef = useRef(false);
  const duplicatingPartyRef = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function loadParty() {
      if (!id) {
        setParty(null);
        setIsConfirmedHost(false);
        setLoading(false);
        return;
      }

      try {
        const [storedParty, storedUserId] = await Promise.all([
          getPartyById(id),
          ensureUserId(),
        ]);

        if (!isMounted) return;

        setParty(storedParty);
        setIsConfirmedHost(Boolean(storedUserId && storedParty?.hostId === storedUserId));
      } catch {
        if (!isMounted) return;
        setParty(null);
        setIsConfirmedHost(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadParty();

    return () => {
      isMounted = false;
    };
  }, [id]);

  async function addHostPartyId(partyId: string) {
    const raw = await AsyncStorage.getItem("hostPartyIds");
    const parsedHostIds = raw ? JSON.parse(raw) : [];
    const hostIds: string[] = Array.isArray(parsedHostIds) ? parsedHostIds : [];
    if (!hostIds.includes(partyId)) {
      hostIds.push(partyId);
      await AsyncStorage.setItem("hostPartyIds", JSON.stringify(hostIds));
    }
  }

  async function handleSendReminder() {
    if (!party || sendingReminderRef.current) return;
    if (!isConfirmedHost) return;

    sendingReminderRef.current = true;
    setSendingReminder(true);
    try {
      await sharePartyReminder(party);
    } catch (error) {
      console.log("[pick-action] sendReminderFailed", {
        partyId: party.id,
        error,
      });
      Alert.alert("Reminder failed", "Could not open the share sheet for this reminder.");
    } finally {
      sendingReminderRef.current = false;
      setSendingReminder(false);
    }
  }

  async function handleDuplicateParty() {
    if (!party || duplicatingPartyRef.current) return;
    if (!isConfirmedHost) return;

    duplicatingPartyRef.current = true;
    setDuplicatingParty(true);
    try {
      const ownerId = await ensureUserId();
      const duplicate = buildDuplicateParty(party, ownerId);

      await upsertParty(duplicate);

      try {
        await createRemoteParty(duplicate);
      } catch (error) {
        console.log("[pick-action] duplicateRemoteSaveFailed", {
          sourcePartyId: party.id,
          duplicatePartyId: duplicate.id,
          itemCount: duplicate.items.length,
          error,
        });
        Alert.alert(
          "Duplicate saved on this device",
          "The copied party was created locally, but could not sync yet."
        );
        return;
      }

      await setCurrentPartyId(duplicate.id);
      await addHostPartyId(duplicate.id);

      router.push(`/(tabs)/create-party?id=${duplicate.id}`);
    } catch (error) {
      console.log("[pick-action] duplicatePartyFailed", {
        sourcePartyId: party?.id,
        error,
      });
      Alert.alert("Duplicate failed", "Could not duplicate this party.");
    } finally {
      duplicatingPartyRef.current = false;
      setDuplicatingParty(false);
    }
  }

  async function handleDeleteParty() {
    if (!id || deletingParty) return;
    if (!isConfirmedHost) {
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

  if (loading) {
    return (
      <ThemedView
        style={[styles.screen, styles.loading]}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading party actions"
      >
        <ActivityIndicator />
      </ThemedView>
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
            accessibilityRole="button"
            accessibilityLabel="Join party"
            accessibilityHint="Opens the party page to RSVP and claim items"
          >
            <ThemedText style={styles.primaryLabel}>OPEN</ThemedText>
            <ThemedText type="subtitle" style={styles.primaryTitle}>Join Party</ThemedText>
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
            accessibilityRole="button"
            accessibilityLabel="Share party"
          >
            <ThemedText style={styles.secondaryLabel}>SEND</ThemedText>
            <ThemedText type="subtitle" style={styles.secondaryTitle}>
              Share Party
            </ThemedText>
            <ThemedText style={styles.secondaryBody}>Copy or send this invite</ThemedText>
          </Pressable>

          {isConfirmedHost ? (
            <>
              <Pressable
                onPress={() => {
                  if (!id) return;
                  router.push(`/create-party?id=${id}`);
                }}
                style={styles.secondaryCard}
                accessibilityRole="button"
                accessibilityLabel="Edit party"
              >
                <ThemedText style={styles.secondaryLabel}>HOST</ThemedText>
                <ThemedText type="subtitle" style={styles.secondaryTitle}>
                  Edit Party
                </ThemedText>
                <ThemedText style={styles.secondaryBody}>Change details and items</ThemedText>
              </Pressable>

              <Pressable
                onPress={handleSendReminder}
                disabled={sendingReminder}
                style={[styles.secondaryCard, sendingReminder ? styles.cardDisabled : null]}
                accessibilityRole="button"
                accessibilityLabel="Send party reminder"
                accessibilityState={{ disabled: sendingReminder, busy: sendingReminder }}
              >
                <ThemedText style={styles.secondaryLabel}>HOST</ThemedText>
                <ThemedText type="subtitle" style={styles.secondaryTitle}>
                  {sendingReminder ? "Opening..." : "Send Reminder"}
                </ThemedText>
                <ThemedText style={styles.secondaryBody}>Remind guests to RSVP and check the bring list</ThemedText>
              </Pressable>

              <Pressable
                onPress={handleDuplicateParty}
                disabled={duplicatingParty}
                style={[styles.secondaryCard, duplicatingParty ? styles.cardDisabled : null]}
                accessibilityRole="button"
                accessibilityLabel="Duplicate party"
                accessibilityState={{ disabled: duplicatingParty, busy: duplicatingParty }}
              >
                <ThemedText style={styles.secondaryLabel}>HOST</ThemedText>
                <ThemedText type="subtitle" style={styles.secondaryTitle}>
                  {duplicatingParty ? "Duplicating..." : "Duplicate Party"}
                </ThemedText>
                <ThemedText style={styles.secondaryBody}>Copy details and unclaimed bring-list items</ThemedText>
              </Pressable>

              <Pressable
                onPress={confirmDeleteParty}
                disabled={deletingParty}
                style={[styles.dangerCard, deletingParty ? styles.cardDisabled : null]}
                accessibilityRole="button"
                accessibilityLabel="Delete party"
                accessibilityState={{ disabled: deletingParty, busy: deletingParty }}
              >
                <ThemedText style={styles.dangerLabel}>HOST</ThemedText>
                <ThemedText type="subtitle" style={styles.dangerTitle}>
                  {deletingParty ? "Deleting..." : "Delete Party"}
                </ThemedText>
                <ThemedText style={styles.dangerBody}>Remove this party permanently</ThemedText>
              </Pressable>
            </>
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
  loading: {
    alignItems: "center",
    justifyContent: "center",
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
