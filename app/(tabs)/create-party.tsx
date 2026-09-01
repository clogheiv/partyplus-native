import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert,
  Animated, findNodeHandle, Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  UIManager,
  View,
} from "react-native";


import React, { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createRemoteParty } from "../../src/data/parties";
import {
  buildEditedPartyItems,
  prependManualPartyItem,
} from "../../src/lib/editPartyItems";
import { createUuid, ensureUserId, ensureUuid, isUuid } from "../../src/lib/ids";
import { focusInputIfNeeded } from "../../src/lib/inputFocus";
import { sharePartyInvite } from "../../src/lib/inviteShare";
import { PARTY_TEMPLATES, mergeTemplateItems } from "../../src/lib/partyTemplates";
import { getPartyById, setCurrentPartyId, upsertParty } from "../../src/lib/partyStore";
import type { Party } from "../../src/lib/partyTypes";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const inputStyle = {
  borderWidth: 1,
  borderColor: "#243554",
  borderRadius: 16,
  padding: 14,
  backgroundColor: "#132038",
  color: "#f6efe7",
};

const inputPlaceholderColor = "#8ea4c5";

const inputStyleMultiline = {
  ...inputStyle,
  minHeight: 90,
  textAlignVertical: "top" as const,
};

export default function CreatePartyScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const isIos = Platform.OS === "ios";
  const scrollRef = useRef<ScrollView>(null);
  const itemInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);
  const savingRef = useRef(false);
  const router = useRouter();
 const params = useLocalSearchParams<{ id?: string | string[] }>();

const partyId =
  typeof params.id === "string"
    ? params.id
    : Array.isArray(params.id)
    ? params.id[0]
    : "";

const isEditing = !!partyId;
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [partyDate, setPartyDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");
  const [iosPickerVisible, setIosPickerVisible] = useState(false);
  const [iosPickerDraft, setIosPickerDraft] = useState(new Date());
  const mergeDatePart = (baseDate: Date | null, nextDate: Date) => {
  const base = baseDate ?? new Date();
  const next = new Date(base);
  next.setFullYear(
    nextDate.getFullYear(),
    nextDate.getMonth(),
    nextDate.getDate()
  );
  return next;
};

const mergeTimePart = (baseDate: Date | null, nextTime: Date) => {
  const base = baseDate ?? new Date();
  const next = new Date(base);
  next.setHours(nextTime.getHours(), nextTime.getMinutes(), 0, 0);
  return next;
};

const closeIosPicker = () => {
  setIosPickerVisible(false);
  setPickerMode("date");
};

const openDateTimePicker = () => {
  if (Platform.OS === "web") {
    Alert.alert(
      "Date picker works on phone",
      "On web, the native date/time picker isn't supported. Use Expo Go on your phone to set date & time."
    );
    return;
  }

  Keyboard.dismiss();

  if (isIos) {
    setIosPickerDraft(partyDate ?? new Date());
    setPickerMode("date");
    setIosPickerVisible(true);
    return;
  }

  setPickerMode("date");
  setShowPicker(true);
};

  const onChangePicker = (
  event: DateTimePickerEvent,
  selected?: Date
) => {
  if (event.type === "dismissed" || !selected) {
    setShowPicker(false);
    setPickerMode("date");
    return;
  }

  if (pickerMode === "date") {
    setPartyDate(mergeDatePart(partyDate, selected));
    setIsDirty(true);
    setPickerMode("time");
    setShowPicker(true);
    return;
  }

  setPartyDate(mergeTimePart(partyDate, selected));
  setIsDirty(true);
  setShowPicker(false);
  setPickerMode("date");
};

const onChangeIosPicker = (
  _event: DateTimePickerEvent,
  selected?: Date
) => {
  if (!selected) return;

  setIosPickerDraft((current) =>
    pickerMode === "date"
      ? mergeDatePart(current, selected)
      : mergeTimePart(current, selected)
  );
};

const confirmIosPicker = () => {
  setPartyDate(iosPickerDraft);
  setIsDirty(true);
  closeIosPicker();
};

  const [webDateText, setWebDateText] = useState("");

  const [itemText, setItemText] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [manualItemPrefixLength, setManualItemPrefixLength] = useState(0);
  const [templateChooserVisible, setTemplateChooserVisible] = useState(false);
 

  const [isDirty, setIsDirty] = useState(false);
  const [lastRemoved, setLastRemoved] = useState<{
  item: string;
  index: number;
  wasManual: boolean;
  } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

// 🔹 STEP 2 — Toast animation + timer refs
const toastAnim = useRef(new Animated.Value(0)).current;
const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const actionFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => {
  const showSub = Keyboard.addListener("keyboardDidShow", (e: any) => {

    setKeyboardHeight(e.endCoordinates.height);
  });

  const hideSub = Keyboard.addListener("keyboardDidHide", () => {
    setKeyboardHeight(0);
  });

  return () => {
    showSub.remove();
    hideSub.remove();
  };
}, []);


useEffect(() => {
  // Clear any previous timer
  if (toastTimerRef.current) {
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
  }

  if (!lastRemoved) {
    // Hide state
    toastAnim.setValue(0);
    return;
  }

  // Animate IN (fade + slide up a touch)
  toastAnim.setValue(0);
  Animated.timing(toastAnim, {
    toValue: 1,
    duration: 180,
    useNativeDriver: true,
  }).start();

  // Auto-dismiss after 3s
  toastTimerRef.current = setTimeout(() => {
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setLastRemoved(null);
    });
  }, 5000);

  // Cleanup on change/unmount
  return () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };
}, [lastRemoved, toastAnim]);

useEffect(() => {
  if (actionFeedbackTimerRef.current) {
    clearTimeout(actionFeedbackTimerRef.current);
    actionFeedbackTimerRef.current = null;
  }

  if (!actionFeedback) return;

  actionFeedbackTimerRef.current = setTimeout(() => {
    setActionFeedback(null);
  }, 2200);

  return () => {
    if (actionFeedbackTimerRef.current) {
      clearTimeout(actionFeedbackTimerRef.current);
      actionFeedbackTimerRef.current = null;
    }
  };
}, [actionFeedback]);

  const resetCreateForm = React.useCallback(async () => {
  await AsyncStorage.removeItem("currentPartyId");
  setTitle("");
  setLocation("");
  setNotes("");
  setPartyDate(null);
  setWebDateText("");
  setItems([]);
  setManualItemPrefixLength(0);
  setItemText("");
  setShowPicker(false);
  setPickerMode("date");
  setIosPickerVisible(false);
  setIosPickerDraft(new Date());
  setIsDirty(false);
  setLastRemoved(null);
  requestAnimationFrame(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  });
  }, []);

const handleStartNewParty = async () => {
  if (!isDirty) {
    await resetCreateForm();
    return;
  }

  Alert.alert(
    "Start a new party?",
    "You have unsaved changes. Starting a new party will clear this form.",
    [
      { text: "Keep Editing", style: "cancel" },
      {
        text: "Clear Form",
        style: "destructive",
        onPress: async () => {
          await resetCreateForm();
        },
      },
    ]
  );
};


const onCancelEdit = async () => {
  if (!isDirty) {
    if (partyId) {
      await AsyncStorage.setItem("currentPartyId", partyId);
      router.replace(`/party/${partyId}`);
      return;
    }
    router.replace("/");
    return;
  }

  Alert.alert(
    "Discard changes?",
    "You have unsaved changes. If you discard, they will be lost.",
    [
      { text: "Keep Editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          if (partyId) {
            await AsyncStorage.setItem("currentPartyId", partyId);
            router.replace(`/party/${partyId}`);
            return;
          }
          router.replace("/");
        },
      },
    ]
  );
};

useEffect(() => {
  let isMounted = true;
  // If we are NOT editing a party, always start with a clean slate
if (!isEditing) {
  void resetCreateForm();
  isMounted = false;
  return;
}

  async function loadForEdit() {
    if (!partyId) return;

    const [existing, storedUserId] = await Promise.all([
      getPartyById(partyId),
      ensureUserId(),
    ]);

    if (!existing || !isMounted) return;

    if (existing.hostId && existing.hostId !== storedUserId) {
      Alert.alert("Host only", "Only the party host can edit this party.");
      router.replace(`/party/${partyId}`);
      return;
    }

    setTitle(existing.title ?? "");
    setLocation(existing.location ?? "");
    setNotes(existing.notes ?? "");

    if (existing.date) {
      const d = new Date(existing.date);
      if (!Number.isNaN(d.getTime())) setPartyDate(d);
    }

    if (Platform.OS === "web" && existing.date) {
      setWebDateText(existing.date);
    }

    setItems((existing.items ?? []).map((it: any) => it.name ?? String(it)));
    setManualItemPrefixLength(0);
  }

  loadForEdit();

  return () => {
    isMounted = false;
  };
  }, [isEditing, partyId, resetCreateForm, router]);

useFocusEffect(
  React.useCallback(() => {
    if (!isEditing) {
      void resetCreateForm();
    }
  }, [isEditing, resetCreateForm])
);

const scrollToInput = (inputRef: React.RefObject<TextInput | null>) => {
  const inputNode = inputRef.current ? findNodeHandle(inputRef.current) : null;
  const scrollNode = scrollRef.current ? findNodeHandle(scrollRef.current) : null;

  if (!inputNode || !scrollNode) return;

  setTimeout(() => {
    UIManager.measureLayout(
      inputNode,
      scrollNode,
      () => {}, // onFail
      (_x, y) => {
        scrollRef.current?.scrollTo({ y: Math.max(y - 20, 0), animated: true });
      }
    );
  }, 80);
};

function addItem() {

  const clean = itemText.trim();
  if (!clean) return;

  setItems((prev) => prependManualPartyItem(prev, clean));
  setManualItemPrefixLength((prev) => prev + 1);
  setIsDirty(true);
  setItemText("");
  focusInputIfNeeded(itemInputRef.current);
}
function removeItem(indexToRemove: number) {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const removed = items[indexToRemove];
  if (removed === undefined) return;

  const wasManual = indexToRemove < manualItemPrefixLength;
  setLastRemoved({ item: removed, index: indexToRemove, wasManual });
  setItems((prev) => prev.filter((_, i) => i !== indexToRemove));
  if (wasManual) {
    setManualItemPrefixLength((prev) => Math.max(prev - 1, 0));
  }

  setIsDirty(true);
}
function undoRemove() {
  if (!lastRemoved) return;

  LayoutAnimation.configureNext(
    LayoutAnimation.Presets.easeInEaseOut
  );

  setItems((prev) => {
    const next = [...prev];
    const idx = Math.min(
      Math.max(lastRemoved.index, 0),
      next.length
    );
    next.splice(idx, 0, lastRemoved.item);
    return next;
  });

  if (lastRemoved.wasManual) {
    setManualItemPrefixLength((prev) => prev + 1);
  }

  setLastRemoved(null);
  setIsDirty(true);
}

function confirmRemoveItem(index: number) {
  Alert.alert(
    "Remove item?",
    `Remove "${items[index]}" from the list?`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeItem(index) },
    ]
  );
}

function applyTemplate(template: (typeof PARTY_TEMPLATES)[number]) {
  const merged = mergeTemplateItems(items, template.items);

  if (!merged.addedItems.length) {
    setTemplateChooserVisible(false);
    setActionFeedback(`${template.name} items are already on the list`);
    return;
  }

  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setItems(merged.items);
  setIsDirty(true);
  setActionFeedback(
    `Added ${merged.addedItems.length} ${merged.addedItems.length === 1 ? "item" : "items"}`
  );
  setTemplateChooserVisible(false);
}

  async function handleShareSavedParty(party: Party, id: string) {
    try {
      await sharePartyInvite(party);
    } catch {
      Alert.alert("Share failed", "Could not open the share sheet.");
    } finally {
      router.replace(`/party/${id}`);
    }
  }

  async function handleSave() {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    try {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert("Missing title", "Give your party a name first.");
      return;
    }

    const ownerId = await ensureUserId();
    const id = isEditing ? ensureUuid(partyId) : createUuid();

    const now = new Date().toISOString();
    const existing = isEditing ? await getPartyById(partyId) : null;

    if (isEditing && !existing) {
      Alert.alert("Party not found", "This party could not be loaded for editing.");
      return;
    }

    if (existing?.hostId && existing.hostId !== ownerId) {
      Alert.alert("Host only", "Only the party host can save changes to this party.");
      router.replace(`/party/${partyId}`);
      return;
    }

    let partyDateIso = partyDate?.toISOString();
    if (!partyDateIso && Platform.OS === "web") {
      const raw = webDateText.trim();
      if (raw) {
        const parsedDate = new Date(raw);
        if (Number.isNaN(parsedDate.getTime())) {
          Alert.alert(
            "Invalid date",
            'Use format like: "2026-01-25T16:00" or "1/25/2026 4:00 PM"'
          );
          return;
        }
        partyDateIso = parsedDate.toISOString();
      }
    }

    const party: Party = {
      id,
      title: cleanTitle,
      date: partyDateIso,

      location: location.trim(),
      notes: notes.trim(),
      theme: "",
      hostId: ownerId,
      rsvps: existing?.rsvps ?? [],
      items: buildEditedPartyItems(
        existing?.items ?? [],
        items,
        createUuid,
        (existingId) => (isUuid(existingId) ? existingId : createUuid()),
        manualItemPrefixLength
      ),

      createdAt: isEditing && existing ? existing.createdAt : now,
      updatedAt: now,
    };

    await upsertParty(party);

    try {
      await createRemoteParty(party);
    } catch (error) {
      console.log("[create-party] remoteSaveFailed", {
        partyId: party.id,
        itemCount: party.items.length,
        error,
      });
      Alert.alert(
        "Cloud sync failed",
        "This party was saved on this device, but items did not sync to Supabase. Please try saving again before sharing."
      );
      return;
    }

    await setCurrentPartyId(id);
   // Mark this party as "host-owned" on this device
const raw = await AsyncStorage.getItem("hostPartyIds");
const hostIds: string[] = raw ? JSON.parse(raw) : [];
if (!hostIds.includes(party.id)) {
  hostIds.push(party.id);
  await AsyncStorage.setItem("hostPartyIds", JSON.stringify(hostIds));
}

    setActionFeedback("Party saved 🎉");

    Alert.alert(
      "Party saved 🎉",
      "Would you like to share it now?",
      [
        {
          text: "Maybe later",
          onPress: () => {
            router.replace(`/party/${id}`);
          },
        },
        {
          text: "Share now",
          onPress: () => {
            void handleShareSavedParty(party, id);
          },
        },
      ],
      { cancelable: false }
    );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }
  const canSave = title.trim().length > 0 && !isSaving;

return (
  <>
  <Stack.Screen
  options={{
   headerLeft: () => (
  <Pressable
    onPress={onCancelEdit}
    style={{ paddingHorizontal: 12, paddingVertical: 10 }}
    accessibilityRole="button"
    accessibilityLabel="Cancel editing"
  >
    <ThemedText style={styles.headerActionText}>Cancel</ThemedText>
  </Pressable>
),
  headerStyle: {
    backgroundColor: "#08111f",
  },
  headerTintColor: "#f6efe7",
  headerShadowVisible: false,
  headerTitleStyle: {
    color: "#f6efe7",
    fontWeight: "700",
  },
 
  }}
/>

  <KeyboardAvoidingView
  style={{ flex: 1, backgroundColor: "#08111f" }}
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={headerHeight}
>
  <ThemedView style={{ flex: 1, backgroundColor: "#08111f" }}>
    {lastRemoved && (
    <ThemedView
      style={{
      position: "absolute",
      left: 16,
      right: 16,
      bottom: keyboardHeight + 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#555",
      backgroundColor: "#222",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      zIndex: 999,
      }}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
    <ThemedText style={{ color: "#fff", flex: 1 }}>
      {lastRemoved?.item ? `"${lastRemoved.item}" removed` : "Item removed"}
    </ThemedText>

    <Pressable
      onPress={undoRemove}
      style={{ paddingHorizontal: 10, paddingVertical: 6 }}
    >
      <ThemedText style={{ color: "#6ee7ff", fontWeight: "800" }}>
        UNDO
      </ThemedText>
    </Pressable>
  </ThemedView>
)}

    {actionFeedback && !lastRemoved && (
      <ThemedView
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: keyboardHeight + Math.max(insets.bottom, 20) + 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#2f61f3",
          backgroundColor: "#101a2b",
          zIndex: 998,
        }}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <ThemedText style={{ color: "#f6efe7", fontWeight: "700" }}>
          {actionFeedback}
        </ThemedText>
      </ThemedView>
    )}


   <ScrollView
  ref={scrollRef}
  style={{ flex: 1 }}
  contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 320 }}
  keyboardShouldPersistTaps="handled"
>
      <View style={styles.heroCard}>
        <ThemedText style={styles.eyebrow}>PARTYPLUS</ThemedText>
        <ThemedText type="title" style={styles.heroTitle}>
          {isEditing ? "Edit Party" : "Create Party"}
        </ThemedText>
      </View>

      <ThemedText type="subtitle" style={styles.sectionLabel}>Party title</ThemedText>
      <TextInput
        value={title}
        onChangeText={(t) => {
  setTitle(t);
  setIsDirty(true);
}}

        placeholder="Fin's Birthday Bash"
        placeholderTextColor={inputPlaceholderColor}
        autoCapitalize="words"
        style={inputStyle}
        accessibilityLabel="Party title"
      />

      <ThemedText type="subtitle" style={styles.sectionLabel}>Location</ThemedText>
      <TextInput
        value={location}
        onChangeText={(t) => {
  setLocation(t);
  setIsDirty(true);
}}
        placeholder="123 River Rd / Our house / The camp"
        placeholderTextColor={inputPlaceholderColor}
        style={inputStyle}
        accessibilityLabel="Party location"
      />
<ThemedText type="subtitle" style={styles.sectionLabel}>Date & Time</ThemedText>

<Pressable
onPress={openDateTimePicker}
  accessibilityRole="button"
  accessibilityLabel="Set party date and time"
  style={styles.inputButton}

>
 <ThemedText style={styles.inputButtonText}>
  {partyDate ? partyDate.toLocaleString() : "Set date & time"}

</ThemedText>
 
</Pressable>
{Platform.OS === "web" && (
  <TextInput
    value={webDateText}
    onChangeText={setWebDateText}
    placeholder="YYYY-MM-DDTHH:MM (or use picker if supported)"
    placeholderTextColor={inputPlaceholderColor}
    style={inputStyle}
    inputMode="numeric"
    accessibilityLabel="Party date and time"
  />
)}


{showPicker && (
  <DateTimePicker
    value={partyDate ?? new Date()}
    mode={pickerMode}
    display="default"
    onChange={onChangePicker}
  />
)}

{isIos && (
  <Modal
    visible={iosPickerVisible}
    animationType="slide"
    transparent
    onRequestClose={closeIosPicker}
  >
    <View style={styles.iosPickerOverlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={closeIosPicker}
        accessible={false}
      />
      <View
        style={[
          styles.iosPickerSheetWrap,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <View style={styles.iosPickerSheet}>
          <View style={styles.iosPickerHeader}>
            <Pressable
              onPress={closeIosPicker}
              style={styles.iosPickerAction}
              accessibilityRole="button"
              accessibilityLabel="Cancel date and time"
            >
              <ThemedText style={styles.iosPickerActionText}>Cancel</ThemedText>
            </Pressable>
            <ThemedText style={styles.iosPickerTitle}>Set Date & Time</ThemedText>
            <Pressable
              onPress={confirmIosPicker}
              style={styles.iosPickerAction}
              accessibilityRole="button"
              accessibilityLabel="Confirm date and time"
            >
              <ThemedText style={styles.iosPickerDoneText}>Done</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={styles.iosPickerPreview}>
            {iosPickerDraft.toLocaleString()}
          </ThemedText>

          <View style={styles.iosPickerModeRow}>
            <Pressable
              onPress={() => setPickerMode("date")}
              accessibilityRole="radio"
              accessibilityLabel="Date"
              accessibilityState={{ selected: pickerMode === "date" }}
              style={[
                styles.iosPickerModeButton,
                pickerMode === "date" && styles.iosPickerModeButtonActive,
              ]}
            >
              <ThemedText
                style={[
                  styles.iosPickerModeText,
                  pickerMode === "date" && styles.iosPickerModeTextActive,
                ]}
              >
                Date
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setPickerMode("time")}
              accessibilityRole="radio"
              accessibilityLabel="Time"
              accessibilityState={{ selected: pickerMode === "time" }}
              style={[
                styles.iosPickerModeButton,
                pickerMode === "time" && styles.iosPickerModeButtonActive,
              ]}
            >
              <ThemedText
                style={[
                  styles.iosPickerModeText,
                  pickerMode === "time" && styles.iosPickerModeTextActive,
                ]}
              >
                Time
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.iosPickerControlWrap}>
            <DateTimePicker
              value={iosPickerDraft}
              mode={pickerMode}
              display="spinner"
              textColor="#f6efe7"
              themeVariant="dark"
              onChange={onChangeIosPicker}
              style={styles.iosPickerControl}
            />
          </View>
        </View>
      </View>
    </View>
  </Modal>
)}

      <ThemedText type="subtitle" style={styles.sectionLabel}>Notes</ThemedText>
      <TextInput
        ref={notesInputRef}
        onFocus={() => scrollToInput(notesInputRef)}
        value={notes}
        onChangeText={(t) => {
  setNotes(t);
  setIsDirty(true);
}}
        placeholder="Start time, parking, what to bring, etc."
        placeholderTextColor={inputPlaceholderColor}
        multiline
        style={inputStyleMultiline}
        accessibilityLabel="Party notes"
      />

      <ThemedText type="subtitle" style={styles.sectionLabel}>Party templates</ThemedText>
      <View style={styles.templateSection}>
        <ThemedText style={styles.templateHelperText}>
          Need help getting started? Add a starter bring-list for common party types.
        </ThemedText>
        <Pressable
          onPress={() => setTemplateChooserVisible(true)}
          style={styles.templateApplyButton}
          accessibilityRole="button"
          accessibilityLabel="Choose a party template"
        >
          <ThemedText style={styles.secondaryButtonText}>Choose a Template</ThemedText>
        </Pressable>
      </View>

      <Modal
        visible={templateChooserVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTemplateChooserVisible(false)}
      >
        <View style={styles.templateModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setTemplateChooserVisible(false)}
            accessible={false}
          />
          <View
            style={[
              styles.templateModalWrap,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={styles.templateModalSheet}>
              <View style={styles.templateModalHeader}>
                <View style={styles.templateModalTitleWrap}>
                  <ThemedText style={styles.templateModalTitle}>
                    Choose a Template
                  </ThemedText>
                  <ThemedText style={styles.templateModalHelper}>
                    Adds missing items only.
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => setTemplateChooserVisible(false)}
                  style={styles.templateModalClose}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel template selection"
                >
                  <ThemedText style={styles.iosPickerActionText}>Cancel</ThemedText>
                </Pressable>
              </View>

              <View style={styles.templateList}>
                {PARTY_TEMPLATES.map((template) => {
                  const preview = `${template.items.slice(0, 4).join(", ")}...`;

                  return (
                    <Pressable
                      key={template.id}
                      onPress={() => applyTemplate(template)}
                      style={styles.templateCard}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${template.name} template`}
                      accessibilityHint="Adds missing items to the bring list"
                    >
                      <View style={styles.templateCardTextWrap}>
                        <ThemedText style={styles.templateCardTitle}>
                          {template.name}
                        </ThemedText>
                        <ThemedText style={styles.templateCardPreview}>
                          {preview}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={() => setTemplateChooserVisible(false)}
                style={styles.templateModalCancelButton}
                accessibilityRole="button"
                accessibilityLabel="Cancel template selection"
              >
                <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ThemedText type="subtitle" style={styles.sectionLabel}>What to bring</ThemedText>
      <TextInput
      ref={itemInputRef}
        returnKeyType="done"
        onFocus={() => scrollToInput(itemInputRef)}
        onSubmitEditing={addItem}
        value={itemText}
        onChangeText={setItemText}
        placeholder="Chips, ice, drinks, chairs..."
        placeholderTextColor={inputPlaceholderColor}
        blurOnSubmit={false}
        style={inputStyle}
        accessibilityLabel="Bring list item"
      />

      <Pressable
        onPress={addItem}
        style={styles.addItemButton}
        accessibilityRole="button"
        accessibilityLabel="Add bring list item"
      >
        <ThemedText style={styles.secondaryButtonText}>Add Item</ThemedText>
      </Pressable>

    {items.map((item, index) => (
  <View
    key={`${item}-${index}`}
    style={styles.itemRow}
  >
    <ThemedText style={styles.itemRowText}>
      • {item}
    </ThemedText>

    <Pressable
      onPress={() => confirmRemoveItem(index)}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${item}`}
      hitSlop={8}
    >
      <ThemedText
        style={{
          color: "#ff3b30",
          fontSize: 26,
          fontWeight: "900",
          paddingLeft: 12,
        }}
      >
        X
      </ThemedText>
    </Pressable>
  </View>
))}

<Pressable
  onPress={handleStartNewParty}
  style={styles.secondaryButton}
  accessibilityRole="button"
  accessibilityLabel="Start new party"
>
  <ThemedText style={styles.secondaryButtonText}>Start New Party</ThemedText>
</Pressable>
<Pressable
  onPress={canSave ? handleSave : undefined}
  disabled={!canSave}
  style={[styles.primaryButton, { opacity: canSave ? 1 : 0.35 }]}
  accessibilityRole="button"
  accessibilityLabel="Save party"
  accessibilityState={{ disabled: !canSave, busy: isSaving }}
>
  <ThemedText style={styles.primaryButtonText}>
    {isSaving ? "Saving..." : "Save Party"}
  </ThemedText>
</Pressable>


    
           </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  </>
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
    padding: 20,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#101a2b",
    gap: 8,
    shadowColor: "#020617",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heroTitle: {
    color: "#f6efe7",
  },
  headerActionText: {
    color: "#f6efe7",
    fontWeight: "700",
  },
  sectionLabel: {
    color: "#dfe7f5",
  },
  inputButton: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#36527f",
    borderRadius: 16,
    backgroundColor: "#142544",
  },
  inputButtonText: {
    color: "#f8fbff",
    fontWeight: "700",
  },
  iosPickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(3, 8, 20, 0.55)",
  },
  iosPickerSheetWrap: {
    width: "100%",
    paddingHorizontal: 16,
  },
  iosPickerSheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 520,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#101a2b",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  iosPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  iosPickerAction: {
    minWidth: 72,
    paddingVertical: 8,
  },
  iosPickerActionText: {
    color: "#dfe7f5",
    fontWeight: "600",
  },
  iosPickerDoneText: {
    color: "#6ee7ff",
    fontWeight: "800",
    textAlign: "right",
  },
  iosPickerTitle: {
    flex: 1,
    color: "#f6efe7",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
  },
  iosPickerPreview: {
    marginTop: 12,
    color: "#f6efe7",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
  },
  iosPickerModeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  iosPickerModeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#132038",
    alignItems: "center",
  },
  iosPickerModeButtonActive: {
    borderColor: "#2f61f3",
    backgroundColor: "#16294a",
  },
  iosPickerModeText: {
    color: "#dfe7f5",
    fontWeight: "700",
  },
  iosPickerModeTextActive: {
    color: "#f6efe7",
  },
  iosPickerControlWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 236,
    marginTop: 8,
    marginBottom: 4,
  },
  iosPickerControl: {
    width: "100%",
    maxWidth: 360,
    height: 216,
  },
  templateSection: {
    gap: 10,
  },
  templateHelperText: {
    color: "#afbdd5",
    lineHeight: 21,
  },
  templateList: {
    gap: 10,
  },
  templateCard: {
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: "#101a2b",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  templateCardTextWrap: {
    flex: 1,
    gap: 4,
  },
  templateCardTitle: {
    color: "#f6efe7",
    fontWeight: "800",
    fontSize: 16,
  },
  templateCardPreview: {
    color: "#afbdd5",
    lineHeight: 20,
  },
  templateApplyButton: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 16,
    backgroundColor: "#101a2b",
    alignItems: "center",
  },
  templateModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(3, 8, 20, 0.55)",
  },
  templateModalWrap: {
    width: "100%",
    paddingHorizontal: 16,
  },
  templateModalSheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 560,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#101a2b",
    padding: 16,
    gap: 12,
  },
  templateModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  templateModalTitleWrap: {
    flex: 1,
    gap: 4,
  },
  templateModalTitle: {
    color: "#f6efe7",
    fontSize: 18,
    fontWeight: "800",
  },
  templateModalHelper: {
    color: "#afbdd5",
    lineHeight: 20,
  },
  templateModalClose: {
    paddingVertical: 4,
    paddingLeft: 8,
  },
  templateModalCancelButton: {
    padding: 13,
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 16,
    backgroundColor: "#101a2b",
    alignItems: "center",
  },
  addItemButton: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 16,
    backgroundColor: "#101a2b",
    alignItems: "center",
  },
  itemRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#101a2b",
  },
  itemRowText: {
    flex: 1,
    color: "#dfe7f5",
  },
  secondaryButton: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#243554",
    backgroundColor: "#101a2b",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#f6efe7",
    fontSize: 18,
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2f61f3",
    backgroundColor: "#2f61f3",
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#f6efe7",
    fontSize: 18,
    fontWeight: "700",
  },
});
