import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable, ScrollView, TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";


// These imports must match your project.
// If VS Code underlines any of these, tell me and we’ll adjust the import path names only.
import { getCurrentPartyId, getPartyById, upsertParty } from "../src/partyStore";

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
  const openInMaps = async (address: string) => {
  const q = encodeURIComponent(address.trim());

  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?q=${q}`
      : `geo:0,0?q=${q}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
  } catch {}

  await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
}; 

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
  <ScrollView
    style={{ flex: 1 }}
    contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 80 }}
  >

        <ThemedText type="title">Share</ThemedText>
        <ThemedText>No party selected yet.</ThemedText>
        <ThemedText>Go to Load Parties, pick one, then come back here.</ThemedText>

        <Pressable
          onPress={() => router.push("/load-parties")}
          style={{ borderWidth: 1, borderRadius: 12, padding: 12, alignSelf: "flex-start" }}
        >
          <ThemedText>Go to Load Parties</ThemedText>
        </Pressable>
      </ScrollView>
    );
  }

  return (
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === "ios" ? "padding" : undefined}
    keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
  >
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 14, paddingBottom: 28 }}  
      >

      <View style={{ gap: 6 }}>
  <ThemedText style={{ fontSize: 13, fontWeight: "800", opacity: 0.7 }}>
    Party
  </ThemedText>

  <ThemedText type="title">{party.title}</ThemedText>
    </View>


      <Pressable
        onPress={() => {
          console.log("EDIT pressed, id =", party.id);
          router.push({ pathname: "/(tabs)/create-party", params: { id: party.id } });
        }}
        style={{ borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 10, alignSelf: "flex-start" }}
      >
        <ThemedText>Edit this party</ThemedText>
      </Pressable>

   <ThemedView style={{ gap: 8, padding: 12, borderRadius: 16, borderWidth: 1 }}>
  <ThemedText type="subtitle">Your name (for claiming)</ThemedText>

  <TextInput
    value={yourName}
    onChangeText={setYourName}
    placeholder="Type your name"
    returnKeyType="done"
    blurOnSubmit
    onSubmitEditing={Keyboard.dismiss}
    placeholderTextColor="#777"
    style={{
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      minWidth: 220,
      backgroundColor: "#f2f2f2",
      color: "#000",
    }}
  />

  <ThemedView style={{ gap: 6 }}>
   {!!party.location && (
  <View style={{ gap: 8 }}>
    <ThemedText>{party.location}</ThemedText>

    <Pressable
      onPress={() => openInMaps(party.location!)}
      style={{
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        alignSelf: "flex-start",
        opacity: 0.9,
      }}
    >
      <ThemedText>Open in Maps</ThemedText>
    </Pressable>
  </View>
)}
 
    {!!party.notes && <ThemedText>{party.notes}</ThemedText>}
  </ThemedView>
</ThemedView>

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
          borderColor: claimed ? "#bdbdbd" : "#888",
          borderRadius: 12,
          padding: 14,
          gap: 6,
          backgroundColor: claimed ? "#e9e9e9" : "#fcf1cd",
          opacity: canClaim ? 1 : 0.7,
        }}
      >
        <ThemedText
          style={{
            color: "#000",
            fontSize: 16,
            fontWeight: claimed ? "500" : "700",
            opacity: claimed ? 0.55 : 1,
          }}
        >
          {it.name}
        </ThemedText>

        {claimed ? (
          <ThemedText
            style={{
              color: "#000",
              fontSize: 13,
              opacity: 0.6,
              fontStyle: "italic",
            }}
          >
            Claimed by: {it.claimedBy}
            {claimedByYou ? " (you)" : ""}
          </ThemedText>
        ) : (
          <ThemedText
            style={{
              color: "#000",
              fontSize: 13,
              opacity: 0.8,
            }}
          >
            Tap to claim
          </ThemedText>
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
         </ScrollView>
          </TouchableWithoutFeedback>
  </KeyboardAvoidingView>
); 
}
