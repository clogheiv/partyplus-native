import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { encode as b64encode } from "base-64";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  TextInput,
  View,
} from "react-native";
import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";
import type { Party as PartyType } from "../src/lib/partyTypes";

// URL-safe base64
function toBase64Url(input: string) {
  return b64encode(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildInviteData(party: any) {
  const payload = {
    t: party.title ?? "",
    dt: party.dateTime ?? party.date ?? "",
    l: party.locationName ?? party.location ?? "",
    a: party.address ?? "",
    la: party.lat ?? party.latitude ?? null,
    ln: party.lng ?? party.longitude ?? null,
  };

  const json = JSON.stringify(payload);
  return toBase64Url(encodeURIComponent(json));
}


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
const getInviteEmoji = (title?: string) => {
  if (!title) return "🎉";

  const t = title.toLowerCase();

  if (t.includes("endymion") || t.includes("mardi gras") || t.includes("krewe"))
    return "🎭💜💛💚";

  if (t.includes("parade")) return "🎭🥁";
  if (t.includes("birthday")) return "🎂🎉";
  if (t.includes("bbq") || t.includes("cookout")) return "🔥🍖";
  if (t.includes("game") || t.includes("watch")) return "🏈🍻";
  if (t.includes("nola") || t.includes("new orleans")) return "⚜️🎷";

  return "🎉";
};

export default function ShareScreen() {
  // STEP 1B (TEMP): placeholder link until we wire real deep link + friendly message

const buildShareMessage = () => {
  const title = party?.title?.trim() || "Party";
  const formatWhen = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // fallback if parsing fails

  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const when = party?.date ? `🗓 When: ${formatWhen(party.date)}` : "";
const where = party?.location?.trim() ? `📍 Where: ${party.location.trim()}` : "";

  const notes = party?.notes?.trim() ? `Notes: ${party.notes.trim()}` : "";
const shortLink = party?.id
  ? `https://partyplus-invite.netlify.app/i/${party.id}`
  : "";
const link = shortLink;

const itemsPreview = () => {
  const items = party?.items ?? [];
  if (!items.length) return "";

  // 1) Count duplicates (case-insensitive)
  const counts = new Map<string, number>();
  for (const it of items) {
    const name = (it?.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // 2) Keep first-seen casing for display
  const displayNames: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const name = (it?.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      displayNames.push(name);
    }
  }

  const max = 5;
  const shown = displayNames.slice(0, max);
  const remaining = displayNames.length - shown.length;

  const lines = [
    "",
    "🧺 What to bring",
    ...shown.map((name) => {
      const key = name.toLowerCase();
      const n = counts.get(key) ?? 1;
      return `• ${name}${n > 1 ? ` (x${n})` : ""}`;
    }),
  ];

  if (remaining > 0) lines.push(`...and ${remaining} more`);
  return lines.join("\n");
};

const getInviteEmoji = (title: string = "") => {
  const t = title.toLowerCase();
 if (t.includes("endymion") || t.includes("mardi gras") || t.includes("krewe")) return "🎭💜💛💚";
if (t.includes("nola") || t.includes("new orleans")) return "⚜️🎷";
 
// Wedding vibes
if (t.includes("wedding") || t.includes("rehearsal") || t.includes("bridal") || t.includes("groom")) return "💍👰🤵";
if (t.includes("engagement") || t.includes("fiancé") || t.includes("fiance") || t.includes("bachelorette") || t.includes("bachelor")) return "💍🥂🎉";
if (t.includes("shower") || t.includes("couples shower")) return "🎁💍🥂";

// Stock-the-bar party
if (t.includes("stock the bar") || t.includes("stock-the-bar") || t.includes("stock bar")) return "🍾🥃🍸";

  if (t.includes("birthday")) return "🎂🎉";
  if (t.includes("bbq") || t.includes("grill")) return "🍔🔥";
  if (t.includes("parade")) return "🎭🥁";
  if (t.includes("coffee")) return "☕️✨";
  if (t.includes("brunch")) return "🥞🍳";
  if (t.includes("game") || t.includes("football")) return "🏈🍻";
  if (t.includes("party")) return "🎉🥳";
  if (t.includes("early") || t.includes("morning")) return "🌅☕️";
  if (t.includes("night")) return "🌙🍸";
// 🍾 Stock the Bar / Bar Party (expanded)
if (
  t.includes("bar party") ||
  t.includes("cocktails") ||
  t.includes("booze") ||
  t.includes("liquor")
) {
  return "🍾🥂🍸";
}

// 💍 Wedding / Shower / Engagement (expanded)
if (
  t.includes("wedding") ||
  t.includes("bridal") ||
  t.includes("shower") ||
  t.includes("engagement") ||
  t.includes("couples shower")
) {
  return "💍💒🥂";
}

  return "🎉";
};

const lines = [
`${getInviteEmoji(title)} ${title}`,
  when,
  where,
  notes,
 itemsPreview(),
  "",
"Open in PartyPlus to claim an item 👇",
link,
].filter(Boolean);
 
  return lines.join("\n");
};

const handleCopyInvite = async () => {
  try {
  await Clipboard.setStringAsync(buildShareMessage());
  
    Alert.alert("Copied!", "Invite link copied to clipboard.");
  } catch (e) {
    Alert.alert("Copy failed", "Could not copy the invite link.");
  }
};
const handleNativeShare = async () => {
  try {
    const message = buildShareMessage();
    await Share.share({ message });
  } catch (e) {
    Alert.alert("Share failed", "Could not open the share sheet.");
  }
};

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<PartyType | null>(null);
  const [isHost, setIsHost] = useState(false);

const inviteLink = useMemo(() => {
  if (!party?.id) return "";


  const baseInviteUrl = `https://partyplus-invite.netlify.app/i/${party.id}`;
  const d = buildInviteData(party);
  return `${baseInviteUrl}?d=${encodeURIComponent(d)}`;
}, [party]);

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

  await Linking.openURL(
    `https://www.google.com/maps/search/?api=1&query=${q}`
  );
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
const next = (p as PartyType) ?? null;

setParty(next);

const storedUserId = await AsyncStorage.getItem("userId");
setIsHost(!!storedUserId && !!next?.hostId && next.hostId === storedUserId);
 
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

  const nextParty = { ...party, items: updatedItems };
  

    setParty(nextParty as any);

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


   {isHost ? (
  <Pressable
    onPress={() =>
      router.push({
        pathname: "/(tabs)/create-party",
        params: { id: party.id },
      })
    }
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
) : null}
   

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
        backgroundColor: "rgba(239, 13, 13, 0.85)",
        borderColor: "rgba(220, 38, 38, 0.45)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="location-outline" size={18} color="#fff" />
        <ThemedText style={{ color: "#fff", fontWeight: "700" }}>
          Open in Maps
        </ThemedText>
      </View>
    </Pressable>
  </View>
)}
 
    {!!party.notes && <ThemedText>{party.notes}</ThemedText>}
  </ThemedView>
</ThemedView>
<Pressable
  onPress={handleCopyInvite}
  style={{
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 12,
  }}
>
  <ThemedText style={{ fontSize: 16, fontWeight: "600" }}>
    Copy Invite
  </ThemedText>
</Pressable>
<Pressable
  onPress={handleNativeShare}
  style={{
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  }}
>
  <ThemedText style={{ fontSize: 16, fontWeight: "600" }}>
    Share Invite
  </ThemedText>
</Pressable>


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
  </KeyboardAvoidingView>
); 
}
