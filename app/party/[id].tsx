import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { ThemedText } from "../../components/themed-text";
import { ThemedView } from "../../components/themed-view";
import type { Party } from "../../src/lib/partyTypes";

// Adjust this import path ONLY if VS Code underlines it
import { getPartyById, upsertParty } from "../../src/partyStore";
function trackInviteOpen(partyId: string) {
  console.log("📊 Invite opened", {
    partyId,
    source: "app",
    ts: new Date().toISOString(),
  });
}
async function ensureUserId() {
  let uid = await AsyncStorage.getItem("userId");
  if (!uid) {
    uid = `u_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    await AsyncStorage.setItem("userId", uid);
  }
  return uid;
}

export default function PartyGuestViewScreen() {
console.log("🔥 RUNNING app/party/[id].tsx PartyGuestViewScreen");
 
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; d?: string }>();
const { id } = params;
useEffect(() => {
  if (id) {
    trackInviteOpen(id);
  }
}, [id]);

  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<Party | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [debugHost, setDebugHost] = useState("");

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
     const normalized = {
  ...found,

  // Party-level null -> undefined
  title: found.title ?? undefined,
  date: found.date ?? undefined,
  location: found.location ?? undefined,
  notes: found.notes ?? undefined,
  hostId: found.hostId ?? undefined,

  // Items: claimedBy null -> undefined
  items: (found.items ?? []).map((it) => ({
    ...it,
    claimedBy: (it as any).claimedBy ?? undefined,
  })),
};

setParty(normalized as any);

  
        const storedUserId = await ensureUserId();
        setDebugHost(`storedUserId=${storedUserId ?? "null"} | found.hostId=${found?.hostId ?? "null"} | isHost=pending`);
  console.log("USER ID:", storedUserId);
     
setMyUserId(storedUserId);

if (storedUserId && found?.hostId === storedUserId) {
  setIsHost(true);
} else {
  setIsHost(false);
}
setDebugHost(
  `storedUserId=${storedUserId ?? "null"} | found.hostId=${found.hostId ?? "null"} | isHost=${storedUserId && found.hostId === storedUserId ? "true" : "false"}`
);

// 🔒 Guest safety: force edit OFF even if they deep-linked or came in weird
if (!(storedUserId && found.hostId === storedUserId)) {
  // If you have any local edit state, force it off here:
  // setIsEditing(false);
  // setEditMode(false);

  // If you use navigation params to enable edit, strip them:
  // navigation.setParams({ edit: undefined, mode: undefined });

  // If you navigate to a separate edit screen, kick them back:
  // navigation.navigate("party", { id: String(id) });
}
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
    headerRight: isHost
      ? () => (
          <Pressable onPress={() => {}} style={{ marginRight: 12 }}>
            <Text style={{ fontWeight: "600" }}>Edit</Text>
          </Pressable>
        )
      : undefined,
  });
}, [navigation, party?.title, isHost]);
  


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
      <ThemedText type="title">DEBUG: [id].tsx is rendering</ThemedText> 
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
       <Text style={{ padding: 8, fontSize: 12 }}>
  DEBUG: {debugHost || "(empty)"}
</Text>

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
  const rawLocation = (party.location ?? "").trim();

const displayLocation =
  rawLocation.length === 0
    ? "No location set"
    : rawLocation.length < 6 && !rawLocation.includes(" ")
    ? "Location saved (add more detail to enable Maps)"
    : rawLocation;

const canOpenMaps =
  rawLocation.length >= 6 || rawLocation.includes(" ");

   return (
  <ScrollView
    style={{ flex: 1 }}
    contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 100 }}
  >
    <Text style={{ padding: 8, fontSize: 12 }}>
    HOST DEBUG → {debugHost}
    </Text>

    <ThemedText type="title">{party.title?.trim() || "Party"}</ThemedText>
   
   {isHost ? (
      <Pressable
  onPress={() => router.push(`/(tabs)/create-party?id=${party.id}`)}
  style={{
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    marginTop: 10,
    marginBottom: 6,
  }}
>
  <ThemedText style={{ fontSize: 16, fontWeight: "700" }}>
    ✏️ Edit Party
  </ThemedText>
</Pressable>
) : null}

{isHost ? (
  <Pressable
    onPress={() =>
      router.push({
        pathname: "/pick-action",
        params: { id: party.id },
      })
    }
    style={{
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignSelf: "flex-start",
      marginTop: 10,
      marginBottom: 6,
    }}
  >
    <ThemedText style={{ fontSize: 16, fontWeight: "700" }}>
      ✏️ Edit Party
    </ThemedText>
  </Pressable>
) : null}


      {!!whenText && <ThemedText>When: {whenText}</ThemedText>}

      {!!party.location?.trim() && (
        <ThemedView style={{ padding: 14, borderRadius: 16, gap: 10 }}>
        <ThemedText style={{ fontSize: 16, fontWeight: "700" }}>
          📍 Where
        </ThemedText>
  
         <ThemedText>{displayLocation}</ThemedText> 

       {canOpenMaps ? (
  <Pressable
    onPress={() => openInMaps(rawLocation)}
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
) : null}
  
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

const claimedLabel = claimed
  ? `🔒 Claimed by ${it.claimedBy}`
  : "";

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
{claimed ? (
  <ThemedText style={{ opacity: 0.85 }}>
    🔒 Claimed by {it.claimedBy}
  </ThemedText>
) : null}



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
