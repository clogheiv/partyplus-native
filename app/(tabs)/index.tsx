import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ThemedView style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <ThemedText style={styles.eyebrow}>
              PARTY PLANNING, MADE SIMPLE
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              PartyPlus
            </ThemedText>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push("/create-party")}
              style={styles.primaryCard}
            >
              <ThemedText type="subtitle" style={styles.primaryCardTitle}>
                Create a Party
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push("/load-parties")}
              style={styles.secondaryCard}
            >
              <ThemedText type="subtitle" style={styles.cardTitle}>
                My Parties
              </ThemedText>
            </Pressable>
          </View>

        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#08111f",
  },
  screen: {
    flex: 1,
    backgroundColor: "#08111f",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 18,
  },
  heroCard: {
    paddingTop: 10,
    paddingBottom: 6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#ff9f87",
    marginBottom: 8,
  },
  title: {
    color: "#f6efe7",
    fontSize: 52,
    lineHeight: 56,
  },
  actions: {
    gap: 16,
  },
  secondaryCard: {
    borderWidth: 1,
    borderColor: "#243554",
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 18,
    backgroundColor: "#101a2b",
    shadowColor: "#020617",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  primaryCard: {
    borderWidth: 1,
    borderColor: "#2f61f3",
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 18,
    backgroundColor: "#2f61f3",
    shadowColor: "#17379c",
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  cardTitle: {
    color: "#f6efe7",
    fontSize: 22,
    lineHeight: 26,
  },
  primaryCardTitle: {
    color: "#f6efe7",
    fontSize: 24,
    lineHeight: 28,
  },
});
