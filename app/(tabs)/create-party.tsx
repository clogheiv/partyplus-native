import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, TextInput } from "react-native";

import { useEffect } from "react";
import { getPartyById, setCurrentPartyId, upsertParty } from "../../src/lib/partyStore";
import type { Party } from "../../src/lib/partyTypes";

const inputStyle = {
  borderWidth: 1,
  borderColor: "#888",
  borderRadius: 10,
  padding: 12,
  backgroundColor: "#F2F2F2",
  color: "#000",
};

const inputStyleMultiline = {
  ...inputStyle,
  minHeight: 90,
  textAlignVertical: "top" as const,
};

export default function CreatePartyScreen() {
 const router = useRouter();
 
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [partyDate, setPartyDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");
  const [webDateText, setWebDateText] = useState("");

  const [itemText, setItemText] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const partyId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEditing = !!partyId;


const onCancelEdit = async () => {
  if (partyId) {
    await AsyncStorage.setItem("currentPartyId", partyId);
  }
  router.replace("/share");
};
  const editingId = params?.id;
useEffect(() => {
  let isMounted = true;

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

function addItem() {
  const clean = itemText.trim();
  if (!clean) return;

  setItems((prev) => [...prev, clean]);
  setItemText("");
}

  async function handleSave() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert("Missing title", "Give your party a name first.");
      return;
    }

    const id = editingId ? String(editingId) : `${Date.now()}`;
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
      items: items.map((name, index) => {
  const prev = existing?.items?.[index];

  // If this item already existed, keep ALL its old fields (including claimedBy)
  if (prev) return { ...prev, name };

  // If it's a brand-new item, create it clean
  return {
    id: `${index}-${Date.now()}`,
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
    await setCurrentPartyId(party.id);
    router.replace("/share");
  }

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

  <ThemedView style={{ flex: 1 }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
    >
      {isEditing ? (
  <Pressable onPress={onCancelEdit} style={{ alignSelf: "flex-start" }}>
    <ThemedText type="subtitle">Cancel</ThemedText>
  </Pressable>
) : null}

      <ThemedText type="title">Create Party</ThemedText>

      <ThemedText type="subtitle">Party title</ThemedText>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Fin's Birthday Bash"
        placeholderTextColor="#555"
        autoCapitalize="words"
        style={inputStyle}
      />

      <ThemedText type="subtitle">Location</ThemedText>
      <TextInput
        value={location}
        onChangeText={setLocation}
        placeholder="123 River Rd / Our house / The camp"
        placeholderTextColor="#555"
        style={inputStyle}
      />
<ThemedText type="subtitle">Date & Time</ThemedText>

<Pressable
onPress={() => {
  if (Platform.OS === "web") {
    Alert.alert(
      "Date picker works on phone",
      "On web, the native date/time picker isn’t supported. Use Expo Go on your phone to set date & time."
    );
    return;
  }
  setPickerMode("date");
  setShowPicker(true);
}}
 
  style={{
  padding: 12,
  borderWidth: 1,
  borderColor: "#ccc",
  borderRadius: 8,
  backgroundColor: "#fff",
}}

>
 <ThemedText style={{ color: "#000" }}>
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

      <ThemedText type="subtitle">Notes</ThemedText>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Start time, parking, what to bring, etc."
        placeholderTextColor="#555"
        multiline
        style={inputStyleMultiline}
      />

      <ThemedText type="subtitle">What to bring</ThemedText>
      <TextInput
        value={itemText}
        onChangeText={setItemText}
        placeholder="Chips, ice, drinks, chairs..."
        placeholderTextColor="#555"
        onSubmitEditing={addItem}
        returnKeyType="done"
        blurOnSubmit={false}
        style={inputStyle}
      />

      <Pressable onPress={addItem} style={inputStyle}>
        <ThemedText style={{ color: "#000" }}>Add Item</ThemedText>
      </Pressable>

      {items.map((item, index) => (
        <ThemedText key={index}>• {item}</ThemedText>
      ))}

      <Pressable onPress={handleSave} style={{ marginTop: 20 }}>
        <ThemedText type="subtitle">Save Party</ThemedText>
      </Pressable>

    </ScrollView>
  </ThemedView>
  </>
);
}