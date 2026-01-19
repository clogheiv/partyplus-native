import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

import {
  getCurrentPartyId,
  getPartyById,
  upsertParty,
} from "../src/lib/partyStore";
import type { Party } from "../src/lib/partyTypes";

const inputStyle = {
  borderWidth: 1,
  borderColor: "#888",
  borderRadius: 10,
  padding: 12,
  backgroundColor: "#fcf1cd",
  color: "#000",
};

function formatWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function ShareScreen() {
  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<Party | null>(null);
  const [yourName, setYourName] = useState("");

  const canClaim = useMemo(() => yourName.trim().length > 0, [yourName]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const id = await getCurrentPartyId();
      if (!id) {
        setParty(null);
        return;
      }
      const p = await getPartyById(id);
      setParty(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function toggleClaim(itemId: string) {
    if (!party) return;

    const name = yourName.trim();
    if (!name) {
      Alert.alert("Your name", "Type your name first so we know who’s claiming.");
      return;
    }

    const idx = party.items.findIndex((it) => it.id === itemId);
    if (idx === -1) return;

    const item = party.items[idx];

    // If unclaimed -> claim it
    if (!item.claimedBy) {
      const updated: Party = {
        ...party,
        items: party.items.map((it) =>
          it.id === itemId ? { ...it, claimedBy: name } : it
        ),
      };
      await upsertParty(updated);
      setParty(updated);
      return;
    }

    // If claimed by YOU -> unclaim
    if (item.claimedBy === name) {
      const updated: Party = {
        ...party,
        items: party.items.map((it) =>
          it.id === itemId ? { ...it, claimedBy: undefined } : it
        ),
      };
      await upsertParty(updated);
      setParty(updated);
      return;
    }

    // If claimed by someone else -> block
    Alert.alert("Already claimed", `${item.name} is claimed by ${item.claimedBy}.`);
  }

  if (loading) {
    return (
  <ScrollView
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ padding: 20, gap: 12 }}
  >
        <ActivityIndicator />
      </ScrollView>
    );
  }

  if (!party) {
    return (
      <ThemedView style={{ flex: 1, padding: 20, gap: 10 }}>
        <ThemedText type="title">Share</ThemedText>
        <ThemedText>No party selected yet.</ThemedText>
        <ThemedText>
          Go to Load Parties, pick one, then come back here.
        </ThemedText>
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
  style={{
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    alignSelf: "flex-start",
  }}
>
  <ThemedText>Edit this party</ThemedText>
</Pressable>
   
    <Pressable
  onPress={() => router.push("/load-parties")}
  style={{
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    alignSelf: "flex-start",
  }}
>
  <ThemedText>Pick a saved party</ThemedText>
</Pressable>

<Pressable
  onPress={() => router.push(`/create-party?id=${party.id}`)}
  style={{
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    alignSelf: "flex-start",
  }}
>
  <ThemedText>Edit this party</ThemedText>
</Pressable>
      {!!party.location && <ThemedText>📍 {party.location}</ThemedText>}
      {!!party.notes && <ThemedText>📝 {party.notes}</ThemedText>}
<Pressable
  onPress={() => router.push("/load-parties")}
  style={{
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    alignSelf: "flex-start",
  }}
>
  <ThemedText>View saved parties</ThemedText>
</Pressable>

      <ThemedText>
  Date & Time: {party.date ? formatWhen(party.date) : "Not set"}
</ThemedText>

     <ThemedText type="subtitle">Your name</ThemedText> 
      <TextInput
        value={yourName}
        onChangeText={setYourName}
        placeholder="Type your name to claim items"
        placeholderTextColor="#555"
        autoCapitalize="words"
        style={inputStyle}
      />

      <ThemedText type="subtitle">What to bring</ThemedText>

      {party.items.length === 0 ? (
        <ThemedText>No items listed yet.</ThemedText>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 30 }}>
          {party.items.map((it) => {
            const claimed = !!it.claimedBy;
            const claimedByYou = claimed && it.claimedBy === yourName.trim();

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
                <ThemedText style={{ color: "#000" }}>
                  • {it.name}
                </ThemedText>

                {claimed ? (
                  <ThemedText style={{ color: "#000" }}>
                    Claimed by: {it.claimedBy}
                    {claimedByYou ? " (you)" : ""}
                  </ThemedText>
                ) : (
                  <ThemedText style={{ color: "#000" }}>
                    Tap to claim
                  </ThemedText>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </ThemedView>
  );
}
