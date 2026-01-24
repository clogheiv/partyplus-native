import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function PartyDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>PartyPlus Deep Link</Text>

      <Text style={styles.label}>Party ID:</Text>
      <Text style={styles.id}>{id ?? "(missing id)"}</Text>

      <Text style={styles.note}>
        This screen proves deep linking routing works. Next we’ll load the party
        data from your store by this ID and show a read-only guest view.
      </Text>

      <Pressable onPress={() => router.back()} style={styles.button}>
        <Text style={styles.buttonText}>Go Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", gap: 10 },
  emoji: { fontSize: 40, textAlign: "center" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center" },
  label: { fontSize: 14, opacity: 0.8, textAlign: "center" },
  id: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  note: { marginTop: 12, fontSize: 14, opacity: 0.75, lineHeight: 18, textAlign: "center" },
  button: {
    marginTop: 18,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
});
