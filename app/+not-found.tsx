import { Link } from "expo-router";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <ThemedText type="title">Item not found</ThemedText>
      <ThemedText style={styles.text}>
        This screen doesn't exist.
      </ThemedText>

      <Link href="/" style={styles.link}>
        <ThemedText type="link">Go to Home screen</ThemedText>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  text: {
    marginTop: 8,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
