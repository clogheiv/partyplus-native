import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator } from "react-native";

export default function PartyDeepLinkRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  useEffect(() => {
    if (!id) {
      router.replace("/share");
      return;
    }

    router.replace({
      pathname: "/share",
      params: { partyId: String(id) },
    });
  }, [id, router]);

  return <ActivityIndicator style={{ flex: 1, padding: 20 }} />;
}

