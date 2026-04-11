import { useLocalSearchParams, useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

export default function InviteRouteScreen() {
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const params = useLocalSearchParams<{ id?: string; d?: string }>();
  const [handled, setHandled] = useState(false);

  const targetRoute = useMemo(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const d = Array.isArray(params.d) ? params.d[0] : params.d;

    if (!id) return null;

    return {
      pathname: "/party/[id]" as const,
      params: { id, d: d || undefined },
    };
  }, [params.d, params.id]);

  useEffect(() => {
    if (!rootNavState?.key) return;
    if (handled) return;
    if (!targetRoute) return;

    setHandled(true);
    router.replace(targetRoute);
  }, [handled, rootNavState?.key, router, targetRoute]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
      <Text style={{ fontSize: 16, color: "#666" }}>Opening invite...</Text>
    </View>
  );
}
