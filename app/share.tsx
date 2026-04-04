import { Ionicons } from "@expo/vector-icons";
import { decode as b64decode } from "base-64";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
} from "react-native";
import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";
import { routeFromUrl } from "../src/lib/deepLinkRouting";
import { ensureUserId } from "../src/lib/ids";
import { buildShareMessage } from "../src/lib/inviteShare";
import { getCurrentPartyId, getPartyById, setCurrentPartyId, upsertParty } from "../src/lib/partyStore";
import type { Party as PartyType } from "../src/lib/partyTypes";

export default function ShareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ d?: string; id?: string }>();
  const rootNavState = useRootNavigationState();
  const inviteId = Array.isArray(params.id) ? params.id[0] : params.id;
  const dParam =
    Array.isArray((params as any).d) ? (params as any).d[0]
    : (params as any).d ?? (params as any).data ?? (params as any).payload ?? "";

  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<PartyType | null>(null);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    if (!inviteId) return;
    if (!rootNavState?.key) return;

    const t = setTimeout(() => {
      router.replace({ pathname: "/party/[id]", params: { id: inviteId, d: dParam } });
    }, 0);

    return () => clearTimeout(t);
  }, [dParam, inviteId, rootNavState?.key, router]);

  useEffect(() => {
    if (inviteId && dParam) return;
    if (!rootNavState?.key) return;

    let cancelled = false;

    const recoverInitialInvite = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (!initialUrl || cancelled) return;

      const target = routeFromUrl(initialUrl);
      if (!target || typeof target === "string") return;
      if (target.pathname !== "/party/[id]") return;

      const recoveredId = Array.isArray(target.params?.id)
        ? target.params.id[0]
        : target.params?.id;
      const recoveredD = Array.isArray(target.params?.d)
        ? target.params.d[0]
        : target.params?.d;

      if (!recoveredId) return;

      router.replace({
        pathname: "/party/[id]",
        params: { id: recoveredId, d: recoveredD },
      });
    };

    void recoverInitialInvite();

    return () => {
      cancelled = true;
    };
  }, [dParam, inviteId, rootNavState?.key, router]);

  useEffect(() => {
    async function loadCurrentParty() {
      setLoading(true);
      try {
        let next: PartyType | null = null;

        if (dParam) {
          try {
            const raw = decodeURIComponent(dParam);
            let b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
            while (b64.length % 4) b64 += "=";
            const json = decodeURIComponent(b64decode(b64));
            const decoded = JSON.parse(json);
            next = {
              ...decoded,
              id: decoded?.id ?? decoded?.i ?? inviteId,
              items: Array.isArray(decoded?.items)
                ? decoded.items.map((it: any) => ({
                    ...it,
                    claimedBy: it?.claimedBy ?? undefined,
                  }))
                : decoded?.items ?? [],
            };
            if (next?.id) {
              await upsertParty(next as PartyType);
              await setCurrentPartyId(next.id);
            }
          } catch {}
        }

        if (!next && inviteId) {
          const stored = await getPartyById(inviteId);
          next = (stored as PartyType) ?? null;
          if (next?.id) await setCurrentPartyId(next.id);
        }

        if (!next) {
          const currentPartyId = await getCurrentPartyId();
          if (!currentPartyId) {
            setParty(null);
            return;
          }
          const stored = await getPartyById(currentPartyId);
          next = (stored as PartyType) ?? null;
        }

        setParty(next);

        const storedUserId = await ensureUserId();
        setIsHost(Boolean(storedUserId && next?.hostId && next.hostId === storedUserId));
      } finally {
        setLoading(false);
      }
    }

    void loadCurrentParty();
  }, [dParam, inviteId]);

  async function openInMaps(address: string) {
    const q = encodeURIComponent(address.trim());
    const url = Platform.OS === "ios" ? `http://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch {}

    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  }

  async function handleCopyInvite() {
    if (!party) return;

    try {
      await Clipboard.setStringAsync(buildShareMessage(party));
      Alert.alert("Copied!", "Invite link copied to clipboard.");
    } catch {
      Alert.alert("Copy failed", "Could not copy the invite link.");
    }
  }

  async function handleNativeShare() {
    if (!party) return;

    try {
      await Share.share({ message: buildShareMessage(party) });
    } catch {
      Alert.alert("Share failed", "Could not open the share sheet.");
    }
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
        <ThemedText type="title">Share Invite</ThemedText>
        <ThemedText>No party selected yet.</ThemedText>
        <ThemedText>Open Parties, choose one, then share its invite.</ThemedText>

        <Pressable
          onPress={() => router.push("/load-parties")}
          style={{ borderWidth: 1, borderRadius: 12, padding: 12, alignSelf: "flex-start" }}
        >
          <ThemedText>Go to Parties</ThemedText>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
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
        <ThemedText type="subtitle">Party details</ThemedText>

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

      <ThemedText style={{ opacity: 0.75 }}>
        RSVP and item claims happen on the party screen.
      </ThemedText>

      <Pressable
        onPress={() => router.push("/load-parties")}
        style={{ borderWidth: 1, borderRadius: 12, padding: 12, alignSelf: "flex-start", marginTop: 12 }}
      >
        <ThemedText>Go to Parties</ThemedText>
      </Pressable>
    </ScrollView>
  );
}
