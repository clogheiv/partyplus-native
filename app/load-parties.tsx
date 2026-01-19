import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getParties();
      // newest first (your store already unshifts, but this keeps it consistent)
      const sorted = [...list].sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
      );
      setParties(sorted);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever this screen becomes active
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function openParty(p: Party) {
    await setCurrentPartyId(p.id);
    router.push(`/pick-action?id=${p.id}`);
  }

  return (
    <ThemedView style={{ flex: 1, padding: 20, gap: 12 }}>
      <ThemedText type="title">Load Parties</ThemedText>

      {loading ? (
        <ThemedView style={{ paddingTop: 20 }}>
          <ActivityIndicator />
        </ThemedView>
      ) : parties.length === 0 ? (
        <ThemedView style={{ gap: 10, paddingTop: 10 }}>
          <ThemedText type="subtitle">No saved parties yet.</ThemedText>
          <ThemedText>
            Create one first, then come back here to load it.
          </ThemedText>

          <Pressable
            onPress={() => router.push("/create-party")}
            style={{
              borderWidth: 1,
              borderRadius: 12,
              padding: 14,
              alignItems: "center",
              marginTop: 10,
            }}
          >
            <ThemedText type="subtitle">Go to Create Party</ThemedText>
          </Pressable>
        </ThemedView>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 30 }}>
          {parties.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => openParty(p)}
              style={{
                borderWidth: 1,
                borderRadius: 12,
                padding: 14,
                gap: 6,
              }}
            >
              <ThemedText type="subtitle">{p.title}</ThemedText>

              {!!p.location && (
                <ThemedText>📍 {p.location}</ThemedText>
              )}

           <ThemedText>
  Date & Time: {p.date ? formatWhen(p.date) : "Not set"}
</ThemedText>   
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

