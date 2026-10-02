import { Ionicons } from "@expo/vector-icons";
import { Buffer } from "buffer";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "../../components/themed-text";
import { ThemedView } from "../../components/themed-view";
import { getRemotePartyById } from "../../src/data/parties";
import { createUuid } from "../../src/lib/ids";
import { itemClaimMatchesUser, reconcilePartyState } from "../../src/lib/partyLogic";
import { guestOperations } from "../../src/data/guestOperations";
import { guestIdentityForView } from "../../src/lib/verifiedIdentity";
import { newerParty } from "../../src/lib/partyValidation";
import { createLatestPartyLoader } from "../../src/lib/loadParty";
import { classifyPartyError } from "../../src/lib/partyErrors";
import { getPartyById, setCurrentPartyId, upsertParty, localRepository } from "../../src/lib/partyStore";
import type { Party, PartyRsvpStatus } from "../../src/lib/partyTypes";
import { isSupabaseConfigured, supabase } from "../../src/lib/supabase";

const ITEM_PROMPT_DELAY_MS = 3000;
const STILL_CHOOSING_DELAY_MS = 20000;

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
  const loader = useRef(createLatestPartyLoader()).current;
  const [refresh, setRefresh] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeRejected, setChangeRejected] = useState(false);
  const changeBusy = useRef(false);
  const routeId = useRef(id);
  routeId.current = id;

  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<Party | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpStatus, setRsvpStatus] = useState<PartyRsvpStatus | null>(null);
  const [attendeeCountText, setAttendeeCountText] = useState("1");
  const [savingRsvp, setSavingRsvp] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  const [addingSuggestion, setAddingSuggestion] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const actionFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const partyName =
    (party?.title ?? (party as any)?.t ?? "").toString().trim() || "Party";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setParty(null);
    setLoadError(null);
    setChangeError(null);
    setChangeRejected(false);
    setRsvpName("");
    setRsvpStatus(null);
    setSuggestionText("");
    if (!id) { setLoading(false); setLoadError("This invite has no party ID."); return; }
    const publish = (next: Party | null, error: string | null) => {
      if (!active) return;
      setParty(current => newerParty(current, next ? normalizePartyForView(next) : null));
      setLoadError(error);
      setLoading(false);
      if (next?.cloudStatus === "committed") void upsertParty(next).catch(error => { if (active) setLoadError(classifyPartyError(error).message); });
    };
    void loader.load(String(id), getRemotePartyById, async partyId => {
      const cached = await getPartyById(partyId);
      if (cached) return cached;
      const invite = decodeInvitePayload(d);
      if (!invite) return null;
      // Payload ownership and claims are never treated as authoritative access.
      return normalizePartyForView({
        id: partyId, title: invite.title ?? invite.name ?? invite.t ?? "Party",
        date: invite.date ?? invite.when ?? invite.dt,
        location: invite.location ?? invite.where ?? invite.l ?? invite.location_name,
        notes: invite.notes, items: inviteItemsToPartyItems(invite.items),
      });
    }, publish);
    void guestIdentityForView().then(identity => { if (active) setCurrentUserId(identity); })
      .catch(error => { if (active) setLoadError(classifyPartyError(error).message); });
    void localRepository.getDraft("outbox:" + id).then(pending => {
      if (active && pending) setChangeError("A previous change is pending. Retry it to recover the result before sending another change.");
    }).catch(error => { if (active) setChangeError(classifyPartyError(error).message); });
    return () => { active = false; loader.cancel(); clearClaimPromptTimer(); };
  }, [d, id, refresh, loader]);

  useEffect(() => {
    navigation.setOptions({ title: partyName });
  }, [navigation, partyName]);

  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;
    let active = true;
    const refreshSnapshot = async () => {
      await loader.load(String(id), getRemotePartyById, getPartyById, (next, error) => {
        if (!active) return;
        setParty(current => newerParty(current, next ? normalizePartyForView(next) : null));
        setLoadError(error);
        setLoading(false);
      });
    };
    const channel = supabase.channel("party:" + id);
    for (const table of ["parties", "party_items", "party_rsvps"]) {
      channel.on("postgres_changes", {
        event: "*", schema: "public", table,
        filter: (table === "parties" ? "id" : "party_id") + "=eq." + id,
      }, () => { void refreshSnapshot(); });
    }
    channel.subscribe(status => {
      if (!active) return;
      if (status === "SUBSCRIBED") void refreshSnapshot();
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setLoadError("Live updates disconnected. Retry to refresh this party.");
    });
    const poll = setInterval(() => { if (AppState.currentState === "active" && !changeBusy.current) void refreshSnapshot(); }, 20000);
    const foreground = AppState.addEventListener("change", state => { if (state === "active") void refreshSnapshot(); });
    return () => { active = false; loader.cancel(); clearInterval(poll); foreground.remove(); void supabase.removeChannel(channel); };
  }, [id, loader]);

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

  function scheduleClaimCompletionPrompt(delayMs = ITEM_PROMPT_DELAY_MS) {
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
            scheduleClaimCompletionPrompt(STILL_CHOOSING_DELAY_MS);
          },
        },
      ]);
    }, delayMs);
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

  async function applyGuestChange(intent?: Parameters<typeof guestOperations.run>[1]) {
    if (!party || changeBusy.current) return null;
    const partyId = party.id;
    changeBusy.current = true;
    setChangeError(null);
    setChangeRejected(false);
    try {
      const next = await guestOperations.run(partyId, intent);
      if (!next) return null;
      // Cache only acknowledged server state. A cache failure does not reverse a commit.
      await upsertParty({ ...next, cloudStatus: "committed" });
      await setCurrentPartyId(next.id).catch(() => {
        if (routeId.current === partyId) setChangeError("Saved online, but this device could not update its selected party. Refresh the invitation to check it.");
      });
      const identity = await guestIdentityForView();
      if (routeId.current !== partyId) return null;
      setCurrentUserId(identity);
      setParty(current => newerParty(current, normalizePartyForView(next)));
      return next;
    } catch (error) {
      if (routeId.current === partyId) {
        const failure = classifyPartyError(error);
        setChangeError(failure.message);
        setChangeRejected(failure.serverRejected);
      }
      return null;
    } finally { changeBusy.current = false; }
  }

  async function saveRsvp() {
    if (!party || savingRsvp) return;
    const name = rsvpName.trim();
    if (!name || !rsvpStatus) { Alert.alert("RSVP needed", "Enter your name and choose a response."); return; }
    const attendeeCount = Number(attendeeCountText);
    if (!Number.isInteger(attendeeCount) || attendeeCount < 1 || attendeeCount > 100) {
      Alert.alert("Invalid count", "Choose between 1 and 100 guests."); return;
    }
    setSavingRsvp(true);
    try {
      const next = await applyGuestChange({ kind: "rsvp", response: { name, status: rsvpStatus, attendeeCount } });
      if (next) { Keyboard.dismiss(); showActionFeedback("RSVP saved online"); showRsvpConfirmation(rsvpStatus); }
    } finally { setSavingRsvp(false); }
  }

  async function toggleItemClaim(itemId: string) {
    if (!party || !currentUserRsvp || !canClaimItems) return;
    clearClaimPromptTimer();
    const item = party.items.find(value => value.id === itemId);
    if (!item) return;
    const claim = !itemClaimMatchesUser(item, currentUserRsvp.id, currentUserRsvp.name);
    const next = await applyGuestChange({ kind: "claim", itemId, claim });
    if (next) { showActionFeedback(claim ? "Item claimed online" : "Claim removed online"); scheduleClaimCompletionPrompt(); }
  }

  async function addItemSuggestion() {
    if (!party || addingSuggestion) return;
    const name = suggestionText.trim();
    if (!name) { Alert.alert("Add a suggestion", "Enter something to bring."); return; }
    setAddingSuggestion(true);
    try {
      const next = await applyGuestChange({ kind: "suggest", name });
      if (next) { setSuggestionText(""); Keyboard.dismiss(); showActionFeedback("Suggestion saved online"); }
    } finally { setAddingSuggestion(false); }
  }

  if (loading) {
    return (
      <ThemedView
        style={{ flex: 1, padding: 20, justifyContent: "center", backgroundColor: "#08111f" }}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading party"
      >
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
        <ThemedText type="title" style={styles.heroTitle}>Invitation unavailable</ThemedText>
        <ThemedText style={styles.sectionBody}>{loadError ?? "This party could not be loaded."}</ThemedText>
        <Pressable onPress={() => setRefresh(value => value + 1)} accessibilityRole="button" style={styles.secondaryButton}><ThemedText style={styles.secondaryButtonText}>Retry</ThemedText></Pressable>

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
      {loadError ? <View style={styles.sectionCard}>
        <ThemedText accessibilityRole="alert" style={styles.sectionBody}>{loadError}</ThemedText>
        <Pressable onPress={() => setRefresh(value => value + 1)} accessibilityRole="button"><ThemedText style={styles.secondaryButtonText}>Refresh invitation</ThemedText></Pressable>
      </View> : null}
      {changeError ? <View style={styles.sectionCard}>
        <ThemedText accessibilityRole="alert" style={styles.sectionBody}>{changeError}</ThemedText>
        <Pressable onPress={() => { if (changeRejected) setRefresh(value => value + 1); else void applyGuestChange(); }} accessibilityRole="button"><ThemedText style={styles.secondaryButtonText}>{changeRejected ? "Refresh invitation" : "Retry pending change"}</ThemedText></Pressable>
      </View> : null}
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
            placeholderTextColor="#8ea4c5"
            autoCapitalize="words"
            style={styles.input}
            accessibilityLabel="RSVP name"
          />
        </View>

        <View style={styles.formSection}>
          <ThemedText style={styles.fieldLabel}>Number of Guests</ThemedText>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => changeAttendeeCount(-1)}
              disabled={getAttendeeCountValue() <= 1}
              accessibilityRole="button"
              accessibilityLabel="Decrease guest count"
              accessibilityState={{ disabled: getAttendeeCountValue() <= 1 }}
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
              accessibilityRole="button"
              accessibilityLabel="Increase guest count"
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
                  accessibilityRole="radio"
                  accessibilityLabel={status === "yes" ? "Yes" : status === "no" ? "No" : "Maybe"}
                  accessibilityState={{ selected }}
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
          accessibilityRole="button"
          accessibilityLabel="Save my RSVP"
          accessibilityState={{ disabled: savingRsvp, busy: savingRsvp }}
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
                accessibilityRole="button"
                accessibilityLabel={
                  claimedByYou
                    ? `Unclaim ${it.name}`
                    : claimed
                      ? `${it.name}, claimed by ${it.claimedBy}`
                      : `Claim ${it.name}`
                }
                accessibilityHint={claimedByYou ? "Removes your claim" : undefined}
                accessibilityState={{
                  disabled: !canClaimItems || (claimed && !claimedByYou),
                  selected: claimedByYou,
                }}
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
          placeholderTextColor="#8ea4c5"
          autoCapitalize="sentences"
          returnKeyType="done"
          onFocus={scrollToSuggestionField}
          onSubmitEditing={addItemSuggestion}
          style={styles.input}
          accessibilityLabel="Item suggestion"
        />
        <Pressable
          onPress={addItemSuggestion}
          disabled={addingSuggestion}
          accessibilityRole="button"
          accessibilityLabel="Add item suggestion"
          accessibilityState={{ disabled: addingSuggestion, busy: addingSuggestion }}
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
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
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
        <Pressable
          onPress={confirmLeaveParty}
          style={styles.footerSecondaryButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
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
