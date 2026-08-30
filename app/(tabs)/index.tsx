import { router } from "expo-router";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function HomeScreen() {
  const { height, width } = useWindowDimensions();
  const compactHeight = height < 720;
  const logoSize = Math.min(
    compactHeight ? 270 : 338,
    Math.max(190, Math.round(width * 0.77))
  );
  const logoRadius = Math.round(logoSize * 0.2);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ThemedView style={styles.screen}>
        <ScrollView
          style={styles.scrollView}
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

          <View style={styles.heroActions}>
            <Image
              source={require("../../assets/partyplus-icon.png")}
              style={[
                styles.logo,
                {
                  width: logoSize,
                  height: logoSize,
                  borderRadius: logoRadius,
                },
              ]}
              resizeMode="contain"
              accessibilityLabel="PartyPlus logo"
            />

            <View style={styles.actions}>
              <Pressable
                onPress={() => router.push("/create-party")}
                style={styles.primaryCard}
                accessibilityRole="button"
                accessibilityLabel="Create a Party"
                accessibilityHint="Opens the form to create a new party"
              >
                <ThemedText type="subtitle" style={styles.primaryCardTitle}>
                  Create a Party
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => router.push("/load-parties")}
                style={styles.secondaryCard}
                accessibilityRole="button"
                accessibilityLabel="My Parties"
                accessibilityHint="Opens your saved parties"
              >
                <ThemedText type="subtitle" style={styles.cardTitle}>
                  My Parties
                </ThemedText>
              </Pressable>
            </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
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
  heroActions: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 30,
    width: "100%",
  },
  logo: {
    flexShrink: 0,
  },
  actions: {
    width: "100%",
    gap: 16,
    marginTop: 32,
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
