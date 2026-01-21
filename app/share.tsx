import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

// These imports must match your project.
// If VS Code underlines any of these, tell me and we’ll adjust the import path names only.
import { getCurrentPartyId, getPartyById, upsertParty } from "@/lib/partyStore";

type PartyItem = {
  id: string;
  name: string;
  claimedBy?: string | null;
};

type Party = {
  id: string;
  title: string;
  location?: string | null;
  notes?: string | null;
  date?: string | null;
  items: PartyItem[];
};

export default function ShareScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<Party | null>(null);

  const [yourName, setYourName] = useState("");
  const canClaim = useMemo(() => yourName.trim().length > 0, [yourName]);

  async function loadCurrentParty() {
    setLoading(true);
    try {
      const id = await getCurrentPartyId();
      if (!id) {
        setParty(null);
        return;
      }
      const p = await getPartyById(id);
      setParty((p as Party) ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCurrentParty();
  }, []);

  async function toggleClaim(itemId: string) {
    if (!party) return;
    if (!canClaim) return;

    const me = yourName.trim();

    const updatedItems = party.items.map((it) => {
      if (it.id !== itemId) return it;

      // If unclaimed, claim it. If claimed by you, unclaim. If claimed by someone else, do nothing.
      const claimedBy = it.claimedBy ?? null;
      if (!claimedBy) return { ...it, claimedBy: me };
      if (claimedBy === me) return { ...it, claimedBy: null };
      return it;
    });

    const nextParty: Party = { ...party, items: updatedItems };

    setParty(nextParty);
    await upsertParty(nextParty as any);
  }

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, padding: 20, justifyContent: "center" }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!party) {
    return (
      <ThemedView style={{ flex: 1, padding: 20, gap: 12 }}>
        <ThemedText type="title">Share</ThemedText>
        <ThemedText>No party selected yet.</ThemedText>
        <ThemedText>Go to Load Parties, pick one, then come back here.</ThemedText>

        <Pressable
          onPress={() => router.push("/load-parties")}
          style={{ borderWidth: 1, borderRadius: 12, padding: 12, alignSelf: "flex-start" }}
        >
          <ThemedText>Go to Load Parties</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1, padding: 20, gap: 12 }}>
      <ThemedText type="title">{party.title}</ThemedText>

      <Pressable
        onPress={() => {
          console.log("EDIT pressed, id =", party.id);
          router.push({ pathname: "/(tabs)/create-party", params: { id: party.id } });
        }}
        style={{ borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 10, alignSelf: "flex-start" }}
      >
        <ThemedText>Edit this party</ThemedText>
      </Pressable>

      <ThemedText type="subtitle">Your name (for claiming)</ThemedText>
      <Pressable
        onPress={() => setYourName("Michael")}
        style={{ borderWidth: 1, borderRadius: 12, padding: 10, alignSelf: "flex-start" }}
      >
        <ThemedText>{yourName.trim() ? yourName : "Tap to set name (example)"}</ThemedText>
      </Pressable>

      {!!party.location && <ThemedText>📍 {party.location}</ThemedText>}
      {!!party.notes && <ThemedText>📝 {party.notes}</ThemedText>}

      <ThemedText type="subtitle">What to bring</ThemedText>

      {party.items.length === 0 ? (
        <ThemedText>No items listed yet.</ThemedText>
      ) : (
        party.items.map((it) => {
          const claimed = !!it.claimedBy;
          const claimedByYou = claimed && (it.claimedBy ?? "") === yourName.trim();

          return (
            <Pressable
              key={it.id}
              onPress={() => toggleClaim(it.id)}
              disabled={!canClaim}
              style={{
                borderWidth: 1,
                borderColor: "#888",
                borderRadius: 12,
                padding: 14,
                gap: 6,
                backgroundColor: claimed ? "#e9e9e9" : "#fcf1cd",
                opacity: canClaim ? 1 : 0.7,
              }}
            >
              <ThemedText style={{ color: "#000" }}>• {it.name}</ThemedText>

              {claimed ? (
                <ThemedText style={{ color: "#000" }}>
                  Claimed by: {it.claimedBy}
                  {claimedByYou ? " (you)" : ""}
                </ThemedText>
              ) : (
                <ThemedText style={{ color: "#000" }}>Tap to claim</ThemedText>
              )}
            </Pressable>
          );
        })
      )}

      <Pressable
        onPress={() => router.push("/load-parties")}
        style={{ borderWidth: 1, borderRadius: 12, padding: 12, alignSelf: "flex-start", marginTop: 12 }}
      >
        <ThemedText>Load Parties</ThemedText>
      </Pressable>
    </ThemedView>
  );
}
