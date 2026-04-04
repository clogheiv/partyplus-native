import { Ionicons } from "@expo/vector-icons";
import { Buffer } from "buffer";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  UIManager,
  View,
  findNodeHandle,
} from "react-native";
import { ThemedText } from "../../components/themed-text";
import { ThemedView } from "../../components/themed-view";
import { getRemotePartyById, getRemotePartyItems, updateRemoteParty } from "../../src/data/parties";
import { getRemotePartyRsvps } from "../../src/data/partyRsvps";
import { createUuid, ensureUserId } from "../../src/lib/ids";
import { getPartyById, setCurrentPartyId, upsertParty } from "../../src/lib/partyStore";
import type { Party, PartyRsvpStatus } from "../../src/lib/partyTypes";
import { isSupabaseConfigured, supabase } from "../../src/lib/supabase";

function decodeInvitePayload(d: string | undefined) {
  if (!d) return null;

  try {
    let b64 = d.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";

    const decoded = Buffer.from(b64, "base64").toString("utf8");

    if (decoded.trim().startsWith("{")) {
      return JSON.parse(decoded);
    }

    const maybeJson = decodeURIComponent(decoded);
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
}

function normalizePartyForView(input: any): Party {
  return {
    ...input,
    title: input?.title ?? "Party",
    date: input?.date ?? undefined,
    location: input?.location ?? undefined,
    notes: input?.notes ?? undefined,
    theme: input?.theme ?? undefined,
    hostId: input?.hostId ?? undefined,
    t: input?.t ?? undefined,
    rsvps: Array.isArray(input?.rsvps)
      ? input.rsvps.map((rsvp: any) => ({
          ...rsvp,
          attendeeCount:
            typeof rsvp?.attendeeCount === "number" && Number.isFinite(rsvp.attendeeCount)
              ? Math.max(1, Math.floor(rsvp.attendeeCount))
              : 1,
          updatedAt: rsvp?.updatedAt ?? new Date().toISOString(),
        }))
      : undefined,
    items: Array.isArray(input?.items)
      ? input.items.map((it: any) => ({
          ...it,
          qty: it?.qty ?? undefined,
          claimedBy: it?.claimedBy ?? undefined,
          createdBy: it?.createdBy ?? undefined,
        }))
      : [],
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyLoadedParty(
  nextParty: Party,
  setParty: (party: Party) => void,
  setIsHost: (value: boolean) => void
) {
  await setCurrentPartyId(nextParty.id);
  setParty(nextParty);

  const storedUserId = await ensureUserId();
  setIsHost(Boolean(storedUserId && nextParty.hostId === storedUserId));

  return storedUserId;
}

export default function PartyGuestViewScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const rsvpNameInputRef = useRef<TextInput>(null);
  const whatToBringYRef = useRef(0);
  const claimPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const params = useLocalSearchParams<{ id?: string; d?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const d = Array.isArray(params.d) ? params.d[0] : params.d;
  const didCanonicalizeRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<Party | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpStatus, setRsvpStatus] = useState<PartyRsvpStatus | null>(null);
  const [attendeeCountText, setAttendeeCountText] = useState("1");
  const [savingRsvp, setSavingRsvp] = useState(false);

  const partyName =
    (party?.title ?? (party as any)?.t ?? "").toString().trim() || "Party";

  useEffect(() => {
    const minInviteLoadingMs = id ? 2400 : 0;
    const remoteRetryDelayMs = 900;

    async function loadRemotePartyWithRetry(partyId: string) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const remoteParty = await getRemotePartyById(partyId);
          if (remoteParty) {
            const remoteItems = await getRemotePartyItems(partyId);
            return normalizePartyForView({
              ...remoteParty,
              items: remoteItems,
            });
          }
        } catch {}

        if (attempt === 0) {
          await wait(remoteRetryDelayMs);
        }
      }

      return null;
    }

    const run = async () => {
      const startedAt = Date.now();

      try {
        if (!id) {
          setParty(null);
          return;
        }

        const normalizedRemote = await loadRemotePartyWithRetry(String(id));
        if (normalizedRemote) {
          await upsertParty(normalizedRemote as any);
          const storedUserId = await applyLoadedParty(
            normalizedRemote,
            setParty,
            setIsHost
          );
          setCurrentUserId(storedUserId);
          if (!didCanonicalizeRef.current && typeof d === "string" && d.length > 0) {
            didCanonicalizeRef.current = true;
            router.replace(`/party/${String(id)}`);
          }
          return;
        }

        const found = await getPartyById(String(id));

        if (found && !d) {
          const normalized = normalizePartyForView(found);
          const storedUserId = await applyLoadedParty(
            normalized,
            setParty,
            setIsHost
          );
          setCurrentUserId(storedUserId);

          if (!(storedUserId && normalized.hostId === storedUserId)) {
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

         const invite = decodeInvitePayload(d);
        if (invite) {
          const hydrated = normalizePartyForView({
            id: String(id),
            title: invite.title ?? invite.name ?? invite.t ?? "Party",
            date: invite.date ?? invite.when ?? invite.dt ?? undefined,
            location:
              invite.location ??
              invite.where ??
              invite.l ??
              invite.location_name ??
              undefined,
            notes: invite.notes ?? undefined,
            hostId: invite.hostId ?? invite.host?.id ?? undefined,
            items: Array.isArray(invite.items)
                ? invite.items.map((it: any, index: number) => ({
                    ...it,
                    id: it.id ?? createUuid(),
                    claimedBy: it.claimedBy ?? undefined,
                  }))
              : [],
          });

          await upsertParty(hydrated as any);
          const storedUserId = await applyLoadedParty(
            hydrated,
            setParty,
            setIsHost
          );
          setCurrentUserId(storedUserId);
          if (!didCanonicalizeRef.current && typeof d === "string" && d.length > 0) {
            didCanonicalizeRef.current = true;
            router.replace(`/party/${String(id)}`);
          }
          return;
        }

        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs < minInviteLoadingMs) {
          await wait(minInviteLoadingMs - elapsedMs);
        }

        setParty(null);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [d, id]);

  useEffect(() => {
    navigation.setOptions({ title: partyName });
  }, [navigation, partyName]);

  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;

    let isMounted = true;
    const partyId = String(id);
    const channel = supabase
      .channel(`party_items:${partyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "party_items",
          filter: `party_id=eq.${partyId}`,
        },
        async () => {
          try {
            const remoteItems = await getRemotePartyItems(partyId);
            if (!isMounted) return;

            setParty((currentParty) => {
              if (!currentParty || currentParty.id !== partyId) return currentParty;
              return normalizePartyForView({
                ...currentParty,
                items: remoteItems,
              });
            });
          } catch {}
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;

    let isMounted = true;
    const partyId = String(id);
    const channel = supabase
      .channel(`party_rsvps:${partyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "party_rsvps",
          filter: `party_id=eq.${partyId}`,
        },
        async () => {
          try {
            const remoteRsvps = await getRemotePartyRsvps(partyId);
            if (!isMounted) return;

            setParty((currentParty) => {
              if (!currentParty || currentParty.id !== partyId) return currentParty;
              return normalizePartyForView({
                ...currentParty,
                rsvps: remoteRsvps.length ? remoteRsvps : undefined,
              });
            });
          } catch {}
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [id]);

  const whenText = useMemo(() => {
    if (!party?.date) return "";
    const nextDate = new Date(party.date);
    if (Number.isNaN(nextDate.getTime())) return party.date;
    return nextDate.toLocaleString();
  }, [party?.date]);

  const currentUserRsvp = useMemo(() => {
    if (!party?.rsvps?.length || !currentUserId) return null;
    return party.rsvps.find((rsvp) => rsvp.id === currentUserId) ?? null;
  }, [currentUserId, party?.rsvps]);

  const canClaimItems =
    currentUserRsvp?.status === "yes" && currentUserRsvp.name.trim().length > 0;

  const rsvpSummary = useMemo(() => {
    const summary = { yes: 0, maybe: 0, no: 0 };

    for (const rsvp of party?.rsvps ?? []) {
      const count =
        typeof rsvp.attendeeCount === "number" && Number.isFinite(rsvp.attendeeCount)
          ? Math.max(1, Math.floor(rsvp.attendeeCount))
          : 1;
      summary[rsvp.status] += count;
    }

    return summary;
  }, [party?.rsvps]);

  useEffect(() => {
    if (!currentUserId) return;

    if (currentUserRsvp) {
      setRsvpName(currentUserRsvp.name ?? "");
      setRsvpStatus(currentUserRsvp.status ?? null);
      setAttendeeCountText(String(currentUserRsvp.attendeeCount ?? 1));
      return;
    }

    setRsvpStatus(null);
    setAttendeeCountText("1");
  }, [currentUserId, currentUserRsvp?.updatedAt]);

  const openInMaps = async (address: string) => {
    const q = encodeURIComponent(address.trim());
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?q=${q}`
        : `https://www.google.com/maps/search/?api=1&query=${q}`;
    await Linking.openURL(url);
  };

  function scrollToWhatToBring() {
    scrollRef.current?.scrollTo({
      y: Math.max(whatToBringYRef.current - 20, 0),
      animated: true,
    });
  }

  function scrollToRsvpNameField() {
    const inputNode = rsvpNameInputRef.current
      ? findNodeHandle(rsvpNameInputRef.current)
      : null;
    const scrollNode = scrollRef.current ? findNodeHandle(scrollRef.current) : null;

    if (!inputNode || !scrollNode) return;

    setTimeout(() => {
      UIManager.measureLayout(
        inputNode,
        scrollNode,
        () => {},
        (_x, y) => {
          scrollRef.current?.scrollTo({
            y: Math.max(y - 20, 0),
            animated: true,
          });
        }
      );
    }, 120);
  }

  function clearClaimPromptTimer() {
    if (!claimPromptTimerRef.current) return;
    clearTimeout(claimPromptTimerRef.current);
    claimPromptTimerRef.current = null;
  }

  function scheduleClaimCompletionPrompt() {
    if (!currentUserRsvp || currentUserRsvp.status !== "yes") return;

    clearClaimPromptTimer();
    claimPromptTimerRef.current = setTimeout(() => {
      claimPromptTimerRef.current = null;
      Alert.alert("Done choosing items?", "", [
        {
          text: "Done",
          onPress: () => {
            router.replace("/");
          },
        },
        {
          text: "Still choosing",
          onPress: () => {
            scheduleClaimCompletionPrompt();
          },
        },
      ]);
    }, 3000);
  }

  function showRsvpConfirmation(status: PartyRsvpStatus) {
    const goHome = () => {
      router.replace("/");
    };

    if (status === "yes") {
      Alert.alert("Yay! You're coming to the party!", "", [
        {
          text: "Claim items to bring",
          onPress: () => {
            setTimeout(() => {
              scrollToWhatToBring();
            }, 50);
          },
        },
        { text: "Close", onPress: goHome },
      ]);
      return;
    }

    if (status === "no") {
      Alert.alert("Thanks for letting us know.", "", [{ text: "Close", onPress: goHome }]);
      return;
    }

    Alert.alert("Thanks for your response.", "", [{ text: "Close", onPress: goHome }]);
  }

  useEffect(() => {
    return () => {
      clearClaimPromptTimer();
    };
  }, []);

  async function saveRsvp() {
    if (!party) return;

    const name = rsvpName.trim();
    if (!name) {
      Alert.alert("Missing name", "Enter your name for the RSVP.");
      return;
    }
    if (!rsvpStatus) {
      Alert.alert("Pick a response", "Choose Yes, No, or Maybe.");
      return;
    }

    const attendeeCount = Number.parseInt(attendeeCountText, 10);
    if (!Number.isFinite(attendeeCount) || attendeeCount < 1) {
      Alert.alert("Invalid count", "Attendee count must be 1 or more.");
      return;
    }

    setSavingRsvp(true);
    try {
      let saveSucceeded = true;
      const userId = currentUserId || (await ensureUserId());
      if (!currentUserId) {
        setCurrentUserId(userId);
      }

      const nextRsvp = {
        id: userId,
        name,
        status: rsvpStatus,
        attendeeCount,
        updatedAt: new Date().toISOString(),
      };

      const nextParty = normalizePartyForView({
        ...party,
        rsvps: [...(party.rsvps ?? []).filter((rsvp) => rsvp.id !== userId), nextRsvp],
      });

      setParty(nextParty);
      await upsertParty(nextParty);

      if (isSupabaseConfigured) {
        try {
          const remoteParty = await updateRemoteParty(nextParty);
          if (remoteParty) {
            const normalizedRemote = normalizePartyForView(remoteParty);
            setParty(normalizedRemote);
            await upsertParty(normalizedRemote);
          }
        } catch {
          saveSucceeded = false;
        }
      }

      if (saveSucceeded) {
        Keyboard.dismiss();
        showRsvpConfirmation(rsvpStatus);
      }
    } finally {
      setSavingRsvp(false);
    }
  }

  async function toggleItemClaim(itemId: string) {
    if (!party || !currentUserRsvp || !canClaimItems) return;

    clearClaimPromptTimer();
    const me = currentUserRsvp.name.trim();
    const updatedItems = party.items.map((item) => {
      if (item.id !== itemId) return item;

      const claimedBy = item.claimedBy ?? null;
      if (!claimedBy) return { ...item, claimedBy: me };
      if (claimedBy === me) return { ...item, claimedBy: undefined };
      return item;
    });

    const nextParty = normalizePartyForView({
      ...party,
      items: updatedItems,
    });

    setParty(nextParty);
    await upsertParty(nextParty);

    let claimSaved = true;
    if (isSupabaseConfigured) {
      try {
        const remoteParty = await updateRemoteParty(nextParty);
        if (remoteParty) {
          const normalizedRemote = normalizePartyForView(remoteParty);
          setParty(normalizedRemote);
          await upsertParty(normalizedRemote);
        }
      } catch {
        claimSaved = false;
      }
    }

    if (claimSaved) {
      scheduleClaimCompletionPrompt();
    }
  }

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, padding: 20, justifyContent: "center" }}>
        <ActivityIndicator />
        <ThemedText style={{ textAlign: "center", marginTop: 12 }}>
          Loading party...
        </ThemedText>
      </ThemedView>
    );
  }

  if (!party) {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 80 }}
      >
        <ThemedText type="title">Party not found</ThemedText>
        <ThemedText>This party could not be loaded.</ThemedText>

        <Pressable
          onPress={() => router.replace("/")}
          style={{
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
            alignSelf: "flex-start",
          }}
        >
          <ThemedText style={{ fontSize: 16, fontWeight: "600" }}>
            Go Home
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
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
    >
      <ThemedText type="title">{partyName}</ThemedText>

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
            Edit Party
          </ThemedText>
        </Pressable>
      ) : null}

      {!!whenText && <ThemedText>When: {whenText}</ThemedText>}

      {!!party.location?.trim() && (
        <ThemedView style={{ padding: 14, borderRadius: 16, gap: 10 }}>
          <ThemedText style={{ fontSize: 16, fontWeight: "700" }}>
            Where
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
        <ThemedView style={{ padding: 14, borderRadius: 16, gap: 8 }}>
          <ThemedText style={{ fontSize: 16, fontWeight: "700" }}>
            Notes
          </ThemedText>
          <ThemedText style={{ opacity: 0.8 }}>{party.notes.trim()}</ThemedText>
        </ThemedView>
      )}

      <ThemedView style={{ padding: 14, borderRadius: 16, gap: 10 }}>
        <ThemedText style={{ fontSize: 16, fontWeight: "700" }}>
          Your RSVP
        </ThemedText>

        <ThemedView style={{ padding: 12, borderRadius: 12, gap: 6 }}>
          <ThemedText>Yes: {rsvpSummary.yes}</ThemedText>
          <ThemedText>Maybe: {rsvpSummary.maybe}</ThemedText>
          <ThemedText>No: {rsvpSummary.no}</ThemedText>
        </ThemedView>

        <ThemedView style={{ padding: 12, borderRadius: 12, gap: 6 }}>
          {(party.rsvps ?? []).length ? (
            (party.rsvps ?? []).map((rsvp) => (
              <ThemedText key={rsvp.id}>
                {rsvp.name} - {rsvp.status === "yes" ? "Yes" : rsvp.status === "no" ? "No" : "Maybe"} - {rsvp.attendeeCount}
              </ThemedText>
            ))
          ) : (
            <ThemedText style={{ opacity: 0.7 }}>No RSVPs yet.</ThemedText>
          )}
        </ThemedView>

        <TextInput
          ref={rsvpNameInputRef}
          value={rsvpName}
          onChangeText={setRsvpName}
          onFocus={scrollToRsvpNameField}
          placeholder="Your name"
          placeholderTextColor="#666"
          autoCapitalize="words"
          style={{
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            color: "#000",
            backgroundColor: "#fff",
          }}
        />

        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["yes", "maybe", "no"] as PartyRsvpStatus[]).map((status) => {
            const selected = rsvpStatus === status;
            return (
              <Pressable
                key={status}
                onPress={() => setRsvpStatus(status)}
                style={{
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: selected ? "#ddd" : "transparent",
                }}
              >
                <ThemedText style={{ fontWeight: "600" }}>
                  {status === "yes" ? "Yes" : status === "no" ? "No" : "Maybe"}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={attendeeCountText}
          onChangeText={setAttendeeCountText}
          placeholder="Attendee count"
          placeholderTextColor="#666"
          keyboardType="number-pad"
          inputMode="numeric"
          style={{
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            color: "#000",
            backgroundColor: "#fff",
          }}
        />

        <Pressable
          onPress={saveRsvp}
          disabled={savingRsvp}
          style={{
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            opacity: savingRsvp ? 0.6 : 1,
            alignSelf: "flex-start",
          }}
        >
          <ThemedText style={{ fontSize: 16, fontWeight: "600" }}>
            {savingRsvp ? "Saving..." : "Save RSVP"}
          </ThemedText>
        </Pressable>
      </ThemedView>

      <View
        onLayout={(event) => {
          whatToBringYRef.current = event.nativeEvent.layout.y;
        }}
      >
        <ThemedText type="subtitle">What to bring</ThemedText>
      </View>

      {!canClaimItems ? (
        <ThemedText style={{ opacity: 0.75 }}>
          RSVP Yes to claim items.
        </ThemedText>
      ) : null}

      {party.items?.length ? (
        <View style={{ gap: 10 }}>
          {party.items.map((it, index) => {
            const claimed = !!it.claimedBy;
            const claimedByYou = claimed && it.claimedBy === currentUserRsvp?.name.trim();

            return (
              <Pressable
                key={it.id ?? `${it.name}-${index}`}
                onPress={() => toggleItemClaim(it.id)}
                disabled={!canClaimItems || (claimed && !claimedByYou)}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  opacity: !canClaimItems ? 0.7 : claimed ? 0.55 : 1,
                }}
              >
                <ThemedText style={{ fontSize: 18, fontWeight: "700" }}>
                  {it.name}
                </ThemedText>
                {claimed ? (
                  <ThemedText style={{ opacity: 0.85 }}>
                    Claimed by {it.claimedBy}
                    {claimedByYou ? " (you)" : ""}
                  </ThemedText>
                ) : canClaimItems ? (
                  <ThemedText style={{ opacity: 0.75 }}>
                    Tap to claim
                  </ThemedText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ThemedText>No items listed yet.</ThemedText>
      )}

      {Platform.OS === "web" ? (
        <ThemedView style={{ padding: 14, borderRadius: 16, gap: 10 }}>
          <ThemedText style={{ fontSize: 16, fontWeight: "700" }}>
            Want to claim items?
          </ThemedText>
          <ThemedText style={{ opacity: 0.85 }}>
            {"Open this party in PartyPlus to claim what you're bringing."}
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
      ) : null}
    </ScrollView>
  );
}
