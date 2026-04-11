import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert,
  Animated, findNodeHandle, Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  TextInput,
  UIManager,
  View,
} from "react-native";


import React, { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createRemoteParty, replaceRemotePartyItems } from "../../src/data/parties";
import { createUuid, ensureUserId, ensureUuid, isUuid } from "../../src/lib/ids";
import { buildShareMessage } from "../../src/lib/inviteShare";
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

const inputStyleMultiline = {
  ...inputStyle,
  minHeight: 90,
  textAlignVertical: "top" as const,
};

export default function CreatePartyScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const itemInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);
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
  useEffect(() => {
  if (!isEditing) return;

  (async () => {
    const p = await getPartyById(partyId);
    if (!p) return;

    // Core fields
    setTitle(p.title ?? "");
    setLocation(p.location ?? "");
    setNotes(p.notes ?? "");

    // Date (stored as string | null)
    if (p.date) {
      const d = new Date(p.date);
      if (!isNaN(d.getTime())) setPartyDate(d);
    } else {
      setPartyDate(null);
    }
  })();
}, [isEditing, partyId]);

  const onChangePicker = (_event: any, selected?: Date) => {
  if (!selected) {
    setShowPicker(false);
    return;
  }

  if (pickerMode === "date") {
    const base = partyDate ?? new Date();
    const next = new Date(selected);
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    setPartyDate(next);

    setPickerMode("time");
    setShowPicker(true);
    return;
  }

  const base = partyDate ?? new Date();
  const next = new Date(base);
  next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
  setPartyDate(next);
  setShowPicker(false);
};

  const [webDateText, setWebDateText] = useState("");

  const [itemText, setItemText] = useState("");
  const [items, setItems] = useState<string[]>([]);
 

  const [isDirty, setIsDirty] = useState(false);
  const [lastRemoved, setLastRemoved] = useState<{
  item: string;
  index: number;
  } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  const resetCreateForm = async () => {
  await AsyncStorage.removeItem("currentPartyId");
  setTitle("");
  setLocation("");
  setNotes("");
  setPartyDate(null);
  setWebDateText("");
  setItems([]);
  setItemText("");
  setShowPicker(false);
  setPickerMode("date");
  setIsDirty(false);
  setLastRemoved(null);
  requestAnimationFrame(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  });
};

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

  const editingId = params?.id;
useEffect(() => {
  let isMounted = true;
  // If we are NOT editing a party, always start with a clean slate
if (!isEditing) {
  void resetCreateForm();
  isMounted = false;
  return;
}

  async function loadForEdit() {
    if (!editingId) return;

    const existing = await getPartyById(partyId ?? "");

    if (!existing || !isMounted) return;

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
  }

  loadForEdit();

  return () => {
    isMounted = false;
  };
  }, [editingId]);

useFocusEffect(
  React.useCallback(() => {
    if (!isEditing) {
      void resetCreateForm();
    }
  }, [isEditing])
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

  setItems((prev) => [...prev, clean]);
  setIsDirty(true);
  setItemText("");
  itemInputRef.current?.focus();
}
function removeItem(indexToRemove: number) {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  setItems((prev) => {
    const removed = prev[indexToRemove];
    if (removed !== undefined) {
      setLastRemoved({ item: removed, index: indexToRemove });
    }
    return prev.filter((_, i) => i !== indexToRemove);
  });

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

  async function handleSave() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert("Missing title", "Give your party a name first.");
      return;
    }

    const ownerId = await ensureUserId();
    const id = isEditing ? ensureUuid(partyId) : createUuid();

    const now = new Date().toISOString();
    const existing = editingId ? await getPartyById(String(editingId)) : null;

    const party: Party = {
      id,
      title: cleanTitle,
      date: partyDate
  ? partyDate.toISOString()
  : Platform.OS === "web"
    ? (() => {
        const raw = webDateText.trim();
        if (!raw) return undefined;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) {
          Alert.alert(
            "Invalid date",
            'Use format like: "2026-01-25T16:00" or "1/25/2026 4:00 PM"'
          );
          return undefined;
        }
        return d.toISOString();
      })()
    : undefined,

      location: location.trim(),
      notes: notes.trim(),
      theme: "",
      hostId: ownerId,
      rsvps: existing?.rsvps ?? [],
      items: items.map((name, index) => {
  const prev = existing?.items?.[index];

  // If this item already existed, keep ALL its old fields (including claimedBy)
  if (prev) {
    return {
      ...prev,
      id: isUuid(prev.id) ? prev.id : createUuid(),
      name,
    };
  }

  // If it's a brand-new item, create it clean
  return {
    id: createUuid(),
    name,
    qty: "",
    claimedBy: undefined,
    createdBy: undefined,
  };
}),

      createdAt: editingId && existing ? existing.createdAt : now,
      updatedAt: now,
    };

    await upsertParty(party);
    try {
      await createRemoteParty(party);
      await replaceRemotePartyItems(party.id, party.items ?? []);
    } catch {
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
          onPress: async () => {
            try {
              await Share.share({ message: buildShareMessage(party) });
            } catch {
              Alert.alert("Share failed", "Could not open the share sheet.");
            } finally {
              router.replace(`/party/${id}`);
            }
          },
        },
      ],
      { cancelable: false }
    );
  }
  const canSave = title.trim().length > 0;

return (
  <>
  <Stack.Screen
  options={{
   headerLeft: () => (
  <Pressable onPress={onCancelEdit} style={{ paddingHorizontal: 12 }}>
    <ThemedText>Cancel</ThemedText>
  </Pressable>
),
 
  }}
/>

  <KeyboardAvoidingView
  style={{ flex: 1 }}
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
        placeholderTextColor="#555"
        autoCapitalize="words"
        style={inputStyle}
      />

      <ThemedText type="subtitle" style={styles.sectionLabel}>Location</ThemedText>
      <TextInput
        value={location}
        onChangeText={(t) => {
  setLocation(t);
  setIsDirty(true);
}}
        placeholder="123 River Rd / Our house / The camp"
        placeholderTextColor="#555"
        style={inputStyle}
      />
<ThemedText type="subtitle" style={styles.sectionLabel}>Date & Time</ThemedText>

<Pressable
onPress={() => {
  if (Platform.OS === "web") {
    Alert.alert(
      "Date picker works on phone",
      "On web, the native date/time picker isn't supported. Use Expo Go on your phone to set date & time."
    );
    return;
  }
  setPickerMode("date");
  setShowPicker(true);
}}
 
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
    placeholderTextColor="#555"
    style={inputStyle}
    inputMode="numeric"
  />
)}


{showPicker && (
  <DateTimePicker
    value={partyDate ?? new Date()}
    mode={pickerMode}
    onChange={(event, selected) => {
      if (!selected) {
        setShowPicker(false);
        return;
      }

      setPartyDate(selected);

      if (Platform.OS === "android") {
        if (pickerMode === "date") {
          setPickerMode("time");
          setShowPicker(true);
        } else {
          setShowPicker(false);
        }
      }
    }}
  />
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
        placeholderTextColor="#555"
        multiline
        style={inputStyleMultiline}
      />

      <ThemedText type="subtitle" style={styles.sectionLabel}>What to bring</ThemedText>
      <TextInput
      ref={itemInputRef}
        returnKeyType="done"
        onFocus={() => scrollToInput(itemInputRef)}
        onSubmitEditing={addItem}
        value={itemText}
        onChangeText={setItemText}
        placeholder="Chips, ice, drinks, chairs..."
        placeholderTextColor="#555"
        blurOnSubmit={false}
        style={inputStyle}
      />

      <Pressable onPress={addItem} style={styles.addItemButton}>
        <ThemedText style={styles.secondaryButtonText}>Add Item</ThemedText>
      </Pressable>

    {items.map((item, index) => (
  <ThemedView
    key={`${item}-${index}`}
    style={{ paddingVertical: 8, flexDirection: "row", alignItems: "center" }}
  >
    <ThemedText style={{ flex: 1 }}>
      • {item}
    </ThemedText>

    <Pressable onPress={() => confirmRemoveItem(index)}>
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
  </ThemedView>
))}

<Pressable
  onPress={handleStartNewParty}
  style={styles.secondaryButton}
>
  <ThemedText style={styles.secondaryButtonText}>Start New Party</ThemedText>
</Pressable>
<Pressable
  onPress={canSave ? handleSave : undefined}
  disabled={!canSave}
  style={[styles.primaryButton, { opacity: canSave ? 1 : 0.35 }]}
>
  <ThemedText style={styles.primaryButtonText}>Save Party</ThemedText>
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
  sectionLabel: {
    color: "#dfe7f5",
  },
  inputButton: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 16,
    backgroundColor: "#132038",
  },
  inputButtonText: {
    color: "#f6efe7",
  },
  addItemButton: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 16,
    backgroundColor: "#101a2b",
    alignItems: "center",
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
