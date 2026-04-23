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
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";
import { ensureUserId } from "../src/lib/ids";
import { buildShareMessage, sharePartyInvite } from "../src/lib/inviteShare";
import { getCurrentPartyId, getPartyById, setCurrentPartyId, upsertParty } from "../src/lib/partyStore";
import type { Party as PartyType } from "../src/lib/partyTypes";

export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ d?: string; id?: string }>();
  const rootNavState = useRootNavigationState();
  const inviteId = Array.isArray(params.id) ? params.id[0] : params.id;
  const dParam =
    Array.isArray((params as any).d) ? (params as any).d[0]
    : (params as any).d ?? (params as any).data ?? (params as any).payload ?? "";

  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<PartyType | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    console.log("[share] params", { inviteId, hasPayload: Boolean(dParam), payloadLength: dParam.length });
    if (!inviteId) return;
    if (!rootNavState?.key) return;

    const t = setTimeout(() => {
      console.log("[share] redirectingToParty", { inviteId, hasPayload: Boolean(dParam) });
      router.replace({ pathname: "/party/[id]", params: { id: inviteId, d: dParam } });
    }, 0);

    return () => clearTimeout(t);
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
            console.log("[share] decodedPayload", {
              inviteId,
              keys: Object.keys(decoded ?? {}),
              hasItems: Array.isArray(decoded?.items),
            });
            next = {
              ...decoded,
              id: decoded?.id ?? decoded?.i ?? inviteId,
              items: Array.isArray(decoded?.items)
                ? decoded.items.map((it: any) => ({
                    ...it,
                    claimedBy: it?.claimedBy ?? undefined,
                    claimedByUserId: it?.claimedByUserId ?? undefined,
                  }))
                : decoded?.items ?? [],
            };
            if (next?.id) {
              await upsertParty(next as PartyType);
              await setCurrentPartyId(next.id);
            }
          } catch (error) {
            console.log("[share] decodePayloadFailed", error);
          }
        }

        if (!next && inviteId) {
          const stored = await getPartyById(inviteId);
          console.log("[share] localLookupByInviteId", { inviteId, found: Boolean(stored) });
          next = (stored as PartyType) ?? null;
          if (next?.id) await setCurrentPartyId(next.id);
        }

        if (!next) {
          const currentPartyId = await getCurrentPartyId();
          console.log("[share] currentPartyIdFallback", currentPartyId);
          if (!currentPartyId) {
            setParty(null);
            return;
          }
          const stored = await getPartyById(currentPartyId);
          console.log("[share] localLookupByCurrentPartyId", {
            currentPartyId,
            found: Boolean(stored),
          });
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
    if (!party || sharing) return;

    setSharing(true);
    try {
      await sharePartyInvite(party);
    } catch {
      Alert.alert("Share failed", "Could not open the share sheet.");
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, padding: 20, justifyContent: "center", backgroundColor: "#08111f" }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!party) {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 20,
          gap: 12,
          paddingBottom: Math.max(insets.bottom, 20) + 60,
        }}
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
      style={{ flex: 1, backgroundColor: "#08111f" }}
      contentContainerStyle={{
        paddingHorizontal: 18,
        paddingTop: 20,
        gap: 16,
        paddingBottom: Math.max(insets.bottom, 20) + 14,
      }}
    >
      <ThemedView style={styles.heroCard}>
        <ThemedText style={styles.eyebrow}>
          SHARE INVITE
        </ThemedText>
        <ThemedText type="title" style={styles.heroTitle}>
          {party.title}
        </ThemedText>
        <ThemedText style={styles.heroBody}>
          Copy the invite link or send it with your phone&apos;s share sheet.
        </ThemedText>
      </ThemedView>

      {isHost ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(tabs)/create-party",
              params: { id: party.id },
            })
          }
          style={styles.secondaryButton}
        >
          <ThemedText style={styles.secondaryButtonText}>Edit this party</ThemedText>
        </Pressable>
      ) : null}

      <ThemedView style={styles.detailsCard}>
        <ThemedText type="subtitle" style={styles.detailsTitle}>
          Party details
        </ThemedText>

        <ThemedView style={{ gap: 6 }}>
          {!!party.location && (
            <View style={{ gap: 8 }}>
              <ThemedText style={styles.detailsText}>{party.location}</ThemedText>

              <Pressable
                onPress={() => openInMaps(party.location!)}
                style={styles.mapButton}
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

          {!!party.notes && <ThemedText style={styles.notesText}>{party.notes}</ThemedText>}
        </ThemedView>
      </ThemedView>

      <View style={{ gap: 10 }}>
        <Pressable
          onPress={handleCopyInvite}
          style={styles.secondaryButtonFull}
        >
          <ThemedText style={styles.secondaryButtonText}>
            Copy Invite
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={handleNativeShare}
          disabled={sharing}
          style={[styles.primaryButtonFull, sharing ? { opacity: 0.7 } : null]}
        >
          <ThemedText style={styles.primaryButtonText}>
            Share Invite
          </ThemedText>
        </Pressable>
      </View>

      <ThemedText style={styles.footerCopy}>
        RSVP and item claims happen on the party screen.
      </ThemedText>

      <Pressable
        onPress={() => router.push("/load-parties")}
        style={styles.secondaryButton}
      >
        <ThemedText style={styles.secondaryButtonText}>Go to Parties</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#ff9f87",
  },
  heroCard: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#101a2b",
    shadowColor: "#020617",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heroTitle: {
    color: "#f6efe7",
  },
  heroBody: {
    color: "#afbdd5",
    lineHeight: 22,
  },
  detailsCard: {
    gap: 10,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#101a2b",
  },
  detailsTitle: {
    color: "#f6efe7",
  },
  detailsText: {
    color: "#dfe7f5",
  },
  notesText: {
    color: "#afbdd5",
    lineHeight: 21,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    backgroundColor: "#101a2b",
  },
  secondaryButtonFull: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#101a2b",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f6efe7",
  },
  primaryButtonFull: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2f61f3",
    backgroundColor: "#2f61f3",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f6efe7",
  },
  mapButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    backgroundColor: "#2f61f3",
    borderColor: "#2f61f3",
  },
  footerCopy: {
    color: "#afbdd5",
    lineHeight: 21,
  },
});
