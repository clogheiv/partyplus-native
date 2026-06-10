import { Ionicons } from "@expo/vector-icons";
import { Buffer } from "buffer";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  UIManager,
  View,
  findNodeHandle,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "../../components/themed-text";
import { ThemedView } from "../../components/themed-view";
import {
  createRemoteParty,
  getRemotePartyById,
  getRemotePartyItems,
  replaceRemotePartyItems,
} from "../../src/data/parties";
import { getRemotePartyRsvps, replaceRemotePartyRsvps } from "../../src/data/partyRsvps";
import { buildDuplicateParty } from "../../src/lib/duplicateParty";
import { createUuid, ensureUserId } from "../../src/lib/ids";
import { sharePartyReminder } from "../../src/lib/inviteShare";
import { applyRsvpForUser, itemClaimMatchesUser, reconcilePartyState, toggleItemClaimForUser } from "../../src/lib/partyLogic";
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
  const normalized = {
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
          claimedByUserId: it?.claimedByUserId ?? it?.claimed_by_user_id ?? undefined,
          createdBy: it?.createdBy ?? undefined,
        }))
      : [],
  };

  return reconcilePartyState(normalized);
}

function inviteItemsToPartyItems(items: any): Party["items"] {
  return Array.isArray(items)
    ? items.map((it: any) => ({
        ...it,
        id: it?.id ?? createUuid(),
        qty: it?.qty ?? undefined,
        claimedBy: it?.claimedBy ?? undefined,
        claimedByUserId: it?.claimedByUserId ?? it?.claimed_by_user_id ?? undefined,
        createdBy: it?.createdBy ?? undefined,
      }))
    : [];
}

function timestampValue(value?: string) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
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
  const insets = useSafeAreaInsets();
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
  const [suggestionText, setSuggestionText] = useState("");
  const [addingSuggestion, setAddingSuggestion] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [duplicatingParty, setDuplicatingParty] = useState(false);
  const sendingReminderRef = useRef(false);
  const duplicatingPartyRef = useRef(false);
  const actionFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const partyName =
    (party?.title ?? (party as any)?.t ?? "").toString().trim() || "Party";

  useEffect(() => {
    const minInviteLoadingMs = id ? 2400 : 0;
    const remoteRetryDelayMs = 900;
    console.log("[party] routeParams", {
      id,
      hasPayload: Boolean(d),
      payloadLength: d?.length ?? 0,
    });

    async function loadRemotePartyWithRetry(partyId: string) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          console.log("[party] remoteFetchAttempt", { partyId, attempt });
          const remoteParty = await getRemotePartyById(partyId);
          if (remoteParty) {
            const remoteItems = await getRemotePartyItems(partyId);
            console.log("[party] remoteFetchSuccess", {
              partyId,
              title: remoteParty.title,
              items: remoteItems.length,
              rsvps: remoteParty.rsvps?.length ?? 0,
            });
            return normalizePartyForView({
              ...remoteParty,
              items: remoteItems,
            });
          }
          console.log("[party] remoteFetchEmpty", { partyId, attempt });
        } catch (error) {
          console.log("[party] remoteFetchFailed", { partyId, attempt, error });
        }

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

        const found = await getPartyById(String(id));
        console.log("[party] localLookupById", {
          id: String(id),
          found: Boolean(found),
          hasPayload: Boolean(d),
        });

        const invite = decodeInvitePayload(d);
        console.log("[party] invitePayloadDecoded", {
          id: String(id),
          decoded: Boolean(invite),
          keys: invite ? Object.keys(invite) : [],
        });

        const normalizedRemote = await loadRemotePartyWithRetry(String(id));
        if (normalizedRemote) {
          const localFallbackItems = Array.isArray(found?.items) ? found.items : [];
          const inviteFallbackItems = inviteItemsToPartyItems(invite?.items);
          const shouldRepairFromLocal =
            !normalizedRemote.items.length &&
            localFallbackItems.length > 0 &&
            timestampValue(found?.updatedAt) >= timestampValue(normalizedRemote.updatedAt);
          const shouldRepairFromInvite =
            !normalizedRemote.items.length &&
            !shouldRepairFromLocal &&
            inviteFallbackItems.length > 0;

          let hydratedRemote = normalizedRemote;

          if (shouldRepairFromLocal || shouldRepairFromInvite) {
            const fallbackItems = shouldRepairFromLocal ? localFallbackItems : inviteFallbackItems;
            console.log("[party] repairingMissingRemoteItems", {
              id: String(id),
              source: shouldRepairFromLocal ? "local" : "invite",
              itemCount: fallbackItems.length,
            });

            hydratedRemote = normalizePartyForView({
              ...normalizedRemote,
              items: fallbackItems,
            });

            if (isSupabaseConfigured) {
              try {
                const repairedItems = await replaceRemotePartyItems(
                  hydratedRemote.id,
                  hydratedRemote.items ?? []
                );
                hydratedRemote = normalizePartyForView({
                  ...hydratedRemote,
                  items: repairedItems,
                });
              } catch (error) {
                console.log("[party] remoteItemRepairFailed", {
                  id: String(id),
                  error,
                });
              }
            }
          }

          await upsertParty(hydratedRemote as any);
          const storedUserId = await applyLoadedParty(
            hydratedRemote,
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
            items: inviteItemsToPartyItems(invite.items),
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
        console.log("[party] loadFailed", { id: String(id), hasPayload: Boolean(d) });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [d, id, router]);

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
  }, [currentUserId, currentUserRsvp]);

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

  function scrollToSuggestionField() {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 220);
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
      if (actionFeedbackTimerRef.current) {
        clearTimeout(actionFeedbackTimerRef.current);
      }
    };
  }, []);

  function showActionFeedback(message: string) {
    if (actionFeedbackTimerRef.current) {
      clearTimeout(actionFeedbackTimerRef.current);
    }
    setActionFeedback(message);
    actionFeedbackTimerRef.current = setTimeout(() => {
      setActionFeedback(null);
      actionFeedbackTimerRef.current = null;
    }, 2200);
  }

  function getAttendeeCountValue() {
    const count = Number.parseInt(attendeeCountText, 10);
    return Number.isFinite(count) && count >= 1 ? Math.floor(count) : 1;
  }

  function changeAttendeeCount(delta: number) {
    setAttendeeCountText(String(Math.max(1, getAttendeeCountValue() + delta)));
  }

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

      const nextParty = applyRsvpForUser(party, userId, nextRsvp);

      setParty(nextParty);
      await upsertParty(nextParty);

      if (isSupabaseConfigured) {
        try {
          const remoteRsvps = await replaceRemotePartyRsvps(
            nextParty.id,
            nextParty.rsvps ?? []
          );
          const normalizedRemote = normalizePartyForView({
            ...nextParty,
            rsvps: remoteRsvps.length ? remoteRsvps : undefined,
          });
          setParty(normalizedRemote);
          await upsertParty(normalizedRemote);
        } catch (error) {
          console.log("[party] saveRsvpRemoteFailed", { id: nextParty.id, error });
          saveSucceeded = false;
        }
      }

      if (saveSucceeded) {
        Keyboard.dismiss();
        showActionFeedback(
          rsvpStatus === "yes"
            ? "✓ You're going"
            : rsvpStatus === "no"
              ? "✓ You're not going"
              : "✓ Maybe noted"
        );
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
    const nextParty = toggleItemClaimForUser(party, itemId, currentUserRsvp.id, me);
    const updatedItem = nextParty.items.find((item) => item.id === itemId);

    setParty(nextParty);
    await upsertParty(nextParty);

    let claimSaved = true;
    if (isSupabaseConfigured) {
      try {
        const remoteItems = await replaceRemotePartyItems(
          nextParty.id,
          nextParty.items ?? []
        );
        const normalizedRemote = normalizePartyForView({
          ...nextParty,
          items: remoteItems,
        });
        setParty(normalizedRemote);
        await upsertParty(normalizedRemote);
      } catch (error) {
        console.log("[party] toggleItemClaimRemoteFailed", { id: nextParty.id, error });
        claimSaved = false;
      }
    }

    if (claimSaved) {
      if (updatedItem) {
        showActionFeedback(
          updatedItem.claimedBy === me
            ? `✓ You're bringing ${updatedItem.name}`
            : `✓ Removed ${updatedItem.name}`
        );
      }
      scheduleClaimCompletionPrompt();
    }
  }

  async function addItemSuggestion() {
    if (!party || addingSuggestion) return;

    const name = suggestionText.trim();
    if (!name) {
      Alert.alert("Add a suggestion", "Enter something to bring.");
      return;
    }

    setAddingSuggestion(true);
    try {
      const nextParty = normalizePartyForView({
        ...party,
        items: [
          ...(party.items ?? []),
          {
            id: createUuid(),
            name,
            qty: undefined,
            claimedBy: undefined,
            claimedByUserId: undefined,
            createdBy: currentUserId || undefined,
          },
        ],
      });

      setParty(nextParty);
      await upsertParty(nextParty);

      let suggestionSaved = true;
      if (isSupabaseConfigured) {
        try {
          const remoteItems = await replaceRemotePartyItems(
            nextParty.id,
            nextParty.items ?? []
          );
          const normalizedRemote = normalizePartyForView({
            ...nextParty,
            items: remoteItems,
          });
          setParty(normalizedRemote);
          await upsertParty(normalizedRemote);
        } catch (error) {
          console.log("[party] addItemSuggestionRemoteFailed", { id: nextParty.id, error });
          suggestionSaved = false;
        }
      }

      if (suggestionSaved) {
        setSuggestionText("");
        Keyboard.dismiss();
        showActionFeedback(`Added ${name}`);
      }
    } finally {
      setAddingSuggestion(false);
    }
  }

  async function handleDuplicateParty() {
    if (!party || duplicatingPartyRef.current) return;
    if (!isHost) return;

    duplicatingPartyRef.current = true;
    setDuplicatingParty(true);
    try {
      const ownerId = await ensureUserId();
      const duplicate = buildDuplicateParty(party, ownerId);

      await upsertParty(duplicate);

      try {
        await createRemoteParty(duplicate);
      } catch (error) {
        console.log("[party] duplicateRemoteSaveFailed", {
          sourcePartyId: party.id,
          duplicatePartyId: duplicate.id,
          itemCount: duplicate.items.length,
          error,
        });
        Alert.alert(
          "Duplicate failed",
          "The duplicate was saved on this device, but it did not sync to the cloud. Please try again before sharing."
        );
        return;
      }

      await setCurrentPartyId(duplicate.id);

      const raw = await AsyncStorage.getItem("hostPartyIds");
      const parsedHostIds = raw ? JSON.parse(raw) : [];
      const hostIds: string[] = Array.isArray(parsedHostIds) ? parsedHostIds : [];
      if (!hostIds.includes(duplicate.id)) {
        hostIds.push(duplicate.id);
        await AsyncStorage.setItem("hostPartyIds", JSON.stringify(hostIds));
      }

      router.push(`/(tabs)/create-party?id=${duplicate.id}`);
    } catch (error) {
      console.log("[party] duplicatePartyFailed", {
        sourcePartyId: party?.id,
        error,
      });
      Alert.alert("Duplicate failed", "Could not duplicate this party.");
    } finally {
      duplicatingPartyRef.current = false;
      setDuplicatingParty(false);
    }
  }

  async function handleSendReminder() {
    if (!party || sendingReminderRef.current) return;
    if (!isHost) return;

    sendingReminderRef.current = true;
    setSendingReminder(true);
    try {
      await sharePartyReminder(party);
    } catch (error) {
      console.log("[party] sendReminderFailed", {
        partyId: party.id,
        error,
      });
      Alert.alert("Reminder failed", "Could not open the share sheet for this reminder.");
    } finally {
      sendingReminderRef.current = false;
      setSendingReminder(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, padding: 20, justifyContent: "center", backgroundColor: "#08111f" }}>
        <ActivityIndicator />
        <ThemedText style={{ textAlign: "center", marginTop: 12, color: "#afbdd5" }}>
          Loading party...
        </ThemedText>
      </ThemedView>
    );
  }

  if (!party) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: "#08111f" }}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 80 }}
      >
        <ThemedText type="title" style={styles.heroTitle}>Party not found</ThemedText>
        <ThemedText style={styles.sectionBody}>This party could not be loaded.</ThemedText>

        <Pressable
          onPress={() => router.replace("/")}
          style={styles.secondaryButton}
        >
          <ThemedText style={styles.secondaryButtonText}>
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
  const footerInset = Math.max(insets.bottom, 20) + 12;
  const footerHeight = 74;

  function goBackToPreviousScreen() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    router.replace("/");
  }

  function confirmLeaveParty() {
    Alert.alert(
      "Leave party?",
      "You'll return to the previous screen. Any saved RSVPs or claimed items will stay saved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          onPress: goBackToPreviousScreen,
        },
      ]
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#08111f" }}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: "#08111f" }}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: footerHeight + footerInset + 32 }}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.heroCard}>
        <ThemedText style={styles.eyebrow}>
          PARTY
        </ThemedText>
        <ThemedText type="title" style={styles.heroTitle}>
          {partyName}
        </ThemedText>
        {!!whenText && (
          <ThemedText style={styles.heroBody}>When: {whenText}</ThemedText>
        )}
      </View>

      {isHost ? (
        <View style={styles.hostActions}>
          <Pressable
            onPress={() => router.push(`/(tabs)/create-party?id=${party.id}`)}
            style={styles.secondaryButton}
          >
            <ThemedText style={styles.secondaryButtonText}>
              Edit Party
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleSendReminder}
            disabled={sendingReminder}
            style={[styles.secondaryButton, sendingReminder ? styles.buttonDisabled : null]}
          >
            <ThemedText style={styles.secondaryButtonText}>
              {sendingReminder ? "Opening..." : "Send Reminder"}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleDuplicateParty}
            disabled={duplicatingParty}
            style={[styles.secondaryButton, duplicatingParty ? styles.buttonDisabled : null]}
          >
            <ThemedText style={styles.secondaryButtonText}>
              {duplicatingParty ? "Duplicating..." : "Duplicate Party"}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {!!party.location?.trim() && (
        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>
            Where
          </ThemedText>

          <ThemedText style={styles.sectionBodyStrong}>{displayLocation}</ThemedText>

          {canOpenMaps ? (
            <Pressable
              onPress={() => openInMaps(rawLocation)}
              style={[styles.secondaryButton, styles.inlineButton]}
            >
              <Ionicons name="location-outline" size={18} />
              <ThemedText style={styles.secondaryButtonText}>
                Open in Maps
              </ThemedText>
            </Pressable>
          ) : null}
        </ThemedView>
      )}

      {!!party.notes?.trim() && (
        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeading}>
            Notes
          </ThemedText>
          <ThemedText style={styles.sectionBody}>{party.notes.trim()}</ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.sectionCard}>
        <ThemedText style={styles.sectionHeading}>
          Let the host know
        </ThemedText>
        <ThemedText style={styles.sectionBody}>
          Add your name, guest count, and response.
        </ThemedText>

        <View style={styles.formSection}>
          <ThemedText style={styles.fieldLabel}>Enter Name</ThemedText>
          <TextInput
            ref={rsvpNameInputRef}
            value={rsvpName}
            onChangeText={setRsvpName}
            onFocus={scrollToRsvpNameField}
            placeholder="Your name"
            placeholderTextColor="#666"
            autoCapitalize="words"
            style={styles.input}
          />
        </View>

        <View style={styles.formSection}>
          <ThemedText style={styles.fieldLabel}>Number of Guests</ThemedText>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => changeAttendeeCount(-1)}
              disabled={getAttendeeCountValue() <= 1}
              style={[
                styles.stepperButton,
                getAttendeeCountValue() <= 1 ? styles.stepperButtonDisabled : null,
              ]}
            >
              <ThemedText style={styles.stepperButtonText}>-</ThemedText>
            </Pressable>
            <ThemedText style={styles.stepperValue}>{getAttendeeCountValue()}</ThemedText>
            <Pressable
              onPress={() => changeAttendeeCount(1)}
              style={styles.stepperButton}
            >
              <ThemedText style={styles.stepperButtonText}>+</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.formSection}>
          <ThemedText style={styles.fieldLabel}>Are You Coming?</ThemedText>
          <View style={styles.responseChoices}>
            {(["yes", "maybe", "no"] as PartyRsvpStatus[]).map((status) => {
              const selected = rsvpStatus === status;
              return (
                <Pressable
                  key={status}
                  onPress={() => setRsvpStatus(status)}
                  style={[
                    styles.rsvpChoice,
                    selected ? styles.rsvpChoiceSelected : null,
                  ]}
                >
                  <ThemedText
                    style={{
                      fontWeight: "600",
                      color: selected ? "#f6efe7" : "#dfe7f5",
                    }}
                  >
                    {status === "yes" ? "Yes" : status === "no" ? "No" : "Maybe"}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={saveRsvp}
          disabled={savingRsvp}
          style={[
            styles.primaryButton,
            { opacity: savingRsvp ? 0.6 : 1, alignSelf: "flex-start" },
          ]}
        >
          <ThemedText style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
            {savingRsvp ? "Saving..." : "Save My RSVP"}
          </ThemedText>
        </Pressable>

        <ThemedView style={styles.innerCard}>
          {(party.rsvps ?? []).length ? (
            (party.rsvps ?? []).map((rsvp) => (
              <ThemedText key={rsvp.id} style={styles.rsvpListText}>
                {rsvp.name} - {rsvp.status === "yes" ? "Yes" : rsvp.status === "no" ? "No" : "Maybe"} - {rsvp.attendeeCount}
              </ThemedText>
            ))
          ) : (
            <ThemedText style={styles.sectionBody}>No RSVPs yet.</ThemedText>
          )}
        </ThemedView>

        <View style={styles.summaryRow}>
          <ThemedView style={styles.summaryChip}>
            <ThemedText style={styles.summaryLabel}>Yes</ThemedText>
            <ThemedText style={styles.summaryValue}>{rsvpSummary.yes}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.summaryChip}>
            <ThemedText style={styles.summaryLabel}>Maybe</ThemedText>
            <ThemedText style={styles.summaryValue}>{rsvpSummary.maybe}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.summaryChip}>
            <ThemedText style={styles.summaryLabel}>No</ThemedText>
            <ThemedText style={styles.summaryValue}>{rsvpSummary.no}</ThemedText>
          </ThemedView>
        </View>
      </ThemedView>

      <View
        onLayout={(event) => {
          whatToBringYRef.current = event.nativeEvent.layout.y;
        }}
      >
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          What can you bring?
        </ThemedText>
        <ThemedText style={[styles.sectionBody, styles.sectionIntro]}>
          Tap Claim next to an item you want to bring. Everyone will see that it’s covered.
        </ThemedText>
      </View>

      {!canClaimItems ? (
        <ThemedText style={styles.sectionBody}>
          RSVP Yes to claim items.
        </ThemedText>
      ) : null}

      {party.items?.length ? (
        <View style={{ gap: 10 }}>
          {party.items.map((it, index) => {
            const claimed = !!it.claimedBy;
            const claimedByYou =
              !!currentUserRsvp &&
              itemClaimMatchesUser(it, currentUserRsvp.id, currentUserRsvp.name);

            return (
              <Pressable
                key={it.id ?? `${it.name}-${index}`}
                onPress={() => toggleItemClaim(it.id)}
                disabled={!canClaimItems || (claimed && !claimedByYou)}
                style={[
                  styles.itemCard,
                  { opacity: !canClaimItems ? 0.7 : claimed ? 0.55 : 1 },
                ]}
              >
                <View style={styles.itemCardHeader}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <ThemedText style={{ fontSize: 18, fontWeight: "700", color: "#f6efe7" }}>
                      {it.name}
                    </ThemedText>
                    {claimed ? (
                      <ThemedText style={styles.sectionBodyStrong}>
                        Claimed by {it.claimedBy}
                        {claimedByYou ? " (you)" : ""}
                      </ThemedText>
                    ) : canClaimItems ? (
                      <ThemedText style={styles.sectionBody}>
                        Available
                      </ThemedText>
                    ) : null}
                  </View>
                  {canClaimItems ? (
                    <View
                      style={[
                        styles.claimPill,
                        claimedByYou ? styles.claimPillSelected : null,
                        claimed && !claimedByYou ? styles.claimPillDisabled : null,
                      ]}
                    >
                      <ThemedText style={styles.claimPillText}>
                        {claimedByYou ? "Claimed" : claimed ? "Covered" : "Claim"}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ThemedText style={{ color: "#adc0df" }}>No items listed yet.</ThemedText>
      )}

      <ThemedView style={styles.sectionCard}>
        <ThemedText style={styles.sectionHeading}>
          Suggest something to bring
        </ThemedText>
        <ThemedText style={styles.sectionBody}>
          Don’t see what you want to bring? Add a suggestion to the list.
        </ThemedText>
        <TextInput
          value={suggestionText}
          onChangeText={setSuggestionText}
          placeholder="Example: chips, cups, ice"
          placeholderTextColor="#666"
          autoCapitalize="sentences"
          returnKeyType="done"
          onFocus={scrollToSuggestionField}
          onSubmitEditing={addItemSuggestion}
          style={styles.input}
        />
        <Pressable
          onPress={addItemSuggestion}
          disabled={addingSuggestion}
          style={[
            styles.secondaryButton,
            addingSuggestion ? styles.buttonDisabled : null,
          ]}
        >
          <ThemedText style={styles.secondaryButtonText}>
            {addingSuggestion ? "Adding..." : "Add Suggestion"}
          </ThemedText>
        </Pressable>
      </ThemedView>

      {Platform.OS === "web" ? (
        <ThemedView style={styles.sectionCard}>
        <ThemedText style={{ fontSize: 16, fontWeight: "700", color: "#f6efe7" }}>
          Want to claim items?
        </ThemedText>
          <ThemedText style={styles.sectionBodyStrong}>
            {"Open this party in PartyPlus to claim what you're bringing."}
          </ThemedText>

          <Pressable
            onPress={() => router.replace("/share")}
            style={styles.secondaryButton}
          >
            <ThemedText style={styles.secondaryButtonText}>
              Open in PartyPlus
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}
      </ScrollView>

      {actionFeedback ? (
        <ThemedView
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: footerHeight + footerInset + 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#2f61f3",
            backgroundColor: "#101a2b",
          }}
        >
          <ThemedText style={{ color: "#f6efe7", fontWeight: "700" }}>
            {actionFeedback}
          </ThemedText>
        </ThemedView>
      ) : null}

      <View
        style={[
          styles.bottomActions,
          {
            paddingBottom: footerInset,
          },
        ]}
      >
        <Pressable onPress={confirmLeaveParty} style={styles.footerSecondaryButton}>
          <ThemedText style={styles.secondaryButtonText}>Back</ThemedText>
        </Pressable>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 20,
    borderRadius: 26,
    gap: 8,
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#101a2b",
    shadowColor: "#020617",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ff9f87",
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: "#f6efe7",
  },
  heroBody: {
    color: "#afbdd5",
    lineHeight: 22,
  },
  sectionCard: {
    padding: 18,
    borderRadius: 24,
    gap: 10,
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#101a2b",
    shadowColor: "#020617",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f6efe7",
  },
  sectionBody: {
    color: "#afbdd5",
    lineHeight: 21,
  },
  sectionBodyStrong: {
    color: "#dfe7f5",
    lineHeight: 21,
  },
  innerCard: {
    padding: 12,
    borderRadius: 16,
    gap: 6,
    backgroundColor: "#132038",
    borderWidth: 1,
    borderColor: "#243554",
  },
  rsvpListText: {
    lineHeight: 20,
    color: "#dfe7f5",
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
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f6efe7",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  inlineButton: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: "#2f61f3",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#2f61f3",
  },
  input: {
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: "#f6efe7",
    backgroundColor: "#132038",
  },
  formSection: {
    gap: 8,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#dfe7f5",
  },
  stepper: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 16,
    backgroundColor: "#132038",
    overflow: "hidden",
  },
  stepperButton: {
    width: 48,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#101a2b",
  },
  stepperButtonDisabled: {
    opacity: 0.45,
  },
  stepperButtonText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f6efe7",
  },
  stepperValue: {
    minWidth: 54,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#f6efe7",
  },
  rsvpChoice: {
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#101a2b",
  },
  rsvpChoiceSelected: {
    backgroundColor: "#2f61f3",
    borderColor: "#2f61f3",
  },
  responseChoices: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  summaryChip: {
    minWidth: 86,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#132038",
    gap: 2,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ff9f87",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f6efe7",
  },
  hostActions: {
    gap: 10,
    alignItems: "flex-start",
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: "#b42318",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    backgroundColor: "#5f1515",
  },
  deleteButtonDisabled: {
    opacity: 0.65,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffe4e1",
  },
  itemCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#101a2b",
    gap: 6,
    shadowColor: "#020617",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  itemCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  claimPill: {
    borderWidth: 1,
    borderColor: "#2f61f3",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#2f61f3",
  },
  claimPillSelected: {
    borderColor: "#2f61f3",
    backgroundColor: "#132038",
  },
  claimPillDisabled: {
    borderColor: "#243554",
    backgroundColor: "#132038",
  },
  claimPillText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f6efe7",
  },
  sectionTitle: {
    color: "#f6efe7",
  },
  sectionIntro: {
    marginTop: 6,
  },
  bottomActions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: "#08111f",
    borderTopWidth: 1,
    borderTopColor: "#243554",
  },
  footerSecondaryButton: {
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    backgroundColor: "#101a2b",
  },
});
