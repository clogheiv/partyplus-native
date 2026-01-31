import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { ThemedText } from "../../components/themed-text";
import { ThemedView } from "../../components/themed-view";

// Adjust this import path ONLY if VS Code underlines it
import { getPartyById, upsertParty } from "../../src/partyStore";


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

export default function PartyGuestViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; d?: string }>();
const { id } = params;


  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<Party | null>(null);
  const navigation = useNavigation();



 useEffect(() => {
  const run = async () => {
    try {
      if (!id) {
        setParty(null);
        return;
      }

      // 1) Try to load normally (party already exists on this phone)
      const found = await getPartyById(String(id));
      if (found) {
        setParty(found as any);
        return;
      }

      // 2) If not found, try importing from link param (?d=...)
      // Expo Router may give string | string[]
      const rawD = (params as any)?.d;
      const d = Array.isArray(rawD) ? rawD[0] : rawD;

      if (d) {
        try {
          const decoded = decodeURIComponent(d);
          const importedParty = JSON.parse(decoded);

          // Make sure it has the right id
          importedParty.id = String(id);

          await upsertParty(importedParty);
          setParty(importedParty);
          return;
        } catch (err) {
          // If decoding/parsing fails, fall through to "not found" UI
        }
      }

      setParty(null);
    } finally {
      setLoading(false);
    }
  };

  run();
}, [id]);
useEffect(() => {
  navigation.setOptions({
    title: party?.title ? party.title : "Party",
  });
}, [navigation, party?.title]);


  const whenText = useMemo(() => {
    if (!party?.date) return "";
    const d = new Date(party.date);
    if (Number.isNaN(d.getTime())) return party.date;
    return d.toLocaleString();
  }, [party?.date]);

  const openInMaps = async (address: string) => {
    const q = encodeURIComponent(address.trim());
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?q=${q}`
        : `https://www.google.com/maps/search/?api=1&query=${q}`;
    await Linking.openURL(url);
  };

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
        <ThemedText type="title">Invite</ThemedText>
        <ThemedText>Couldn’t find that party.</ThemedText>

        <Pressable
          onPress={() => router.replace("/share")}
          style={{
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
            alignSelf: "flex-start",
          }}
        >
          <ThemedText style={{ fontSize: 16, fontWeight: "600" }}>
            Go to Share
          </ThemedText>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 100 }}
    >
      <ThemedText type="title">{party.title?.trim() || "Party"}</ThemedText>

      {!!whenText && <ThemedText>When: {whenText}</ThemedText>}

      {!!party.location?.trim() && (
        <ThemedView style={{ padding: 14, borderRadius: 16, gap: 10 }}>
          <ThemedText style={{ fontSize: 16, fontWeight: "700" }}>
            Where
          </ThemedText>
          <ThemedText>{party.location.trim()}</ThemedText>

          <Pressable
            onPress={() => openInMaps(party.location!.trim())}
            style={{
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderWidth: 1,
              alignSelf: "flex-start",
            }}
          >
            <Ionicons name="location-outline" size={18} />
            <ThemedText style={{ fontSize: 16, fontWeight: "600" }}>
              Open in Maps
            </ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {!!party.notes?.trim() && (
        <ThemedView style={{ padding: 14, borderRadius: 16 }}>
          <ThemedText style={{ opacity: 0.8 }}>{party.notes.trim()}</ThemedText>
        </ThemedView>
      )}

      <ThemedText type="subtitle">What to bring</ThemedText>

      {party.items?.length ? (
        <View style={{ gap: 10 }}>
          {party.items.map((it) => {
            const claimed = !!it.claimedBy;
            return (
              <ThemedView
                key={it.id}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  opacity: claimed ? 0.55 : 1,
                }}
              >
                <ThemedText style={{ fontSize: 18, fontWeight: "700" }}>
                  {it.name}
                </ThemedText>
                <ThemedText style={{ opacity: 0.85 }}>
                  {claimed ? `Claimed by: ${it.claimedBy}` : "Unclaimed"}
                </ThemedText>
              </ThemedView>
            );
          })}
        </View>
      ) : (
        <ThemedText>No items listed yet.</ThemedText>
      )}

      <ThemedView style={{ padding: 14, borderRadius: 16, gap: 10 }}>
        <ThemedText style={{ fontSize: 16, fontWeight: "700" }}>
          Want to claim items?
        </ThemedText>
        <ThemedText style={{ opacity: 0.85 }}>
          Open this party in PartyPlus to claim what you’re bringing.
        </ThemedText>

        <Pressable
          onPress={() => router.replace("/share")}
          style={{
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
            alignSelf: "flex-start",
          }}
        >
          <ThemedText style={{ fontSize: 16, fontWeight: "600" }}>
            Open in PartyPlus
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ScrollView>
  );
}
