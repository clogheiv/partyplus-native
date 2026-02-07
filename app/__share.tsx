import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function ShareDeepLinkHandler() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; d?: string }>();
  console.log("[__share handler]", params);
  console.log("HIT___SHARE_ROUTE", params);

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const d = Array.isArray(params.d) ? params.d[0] : params.d;

  useEffect(() => {
    router.replace({ pathname: "/party/[id]", params: { id, d } });
  }, [router, id, d]);

  return null;
}
