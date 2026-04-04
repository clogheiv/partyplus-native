import * as Linking from "expo-linking";
import type { Href } from "expo-router";

function getFirstParam(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
}

export function routeFromUrl(url: string): Href | null {
  const normalizedUrl = url.startsWith("intent://")
    ? url.replace(/^intent:\/\//, "partyplusnative://").replace(/#Intent;.*$/, "")
    : url;
  const parsed = Linking.parse(normalizedUrl);
  const host = parsed.hostname ?? "";
  const path = parsed.path ?? "";
  const queryParams = (parsed.queryParams ?? {}) as Record<string, unknown>;
  const d =
    getFirstParam(queryParams.d) ??
    getFirstParam(queryParams.data) ??
    getFirstParam(queryParams.payload);
  const inviteId = getFirstParam(queryParams.id);
  const combinedPath =
    parsed.scheme === "https" || parsed.scheme === "http"
      ? path
      : host && path
        ? `${host}/${path}`
        : host || path;

  if (combinedPath.startsWith("party/")) {
    const id = combinedPath.split("/")[1];
    if (id) {
      return {
        pathname: "/party/[id]",
        params: { id, d: d || undefined },
      };
    }
  }

  if (combinedPath.startsWith("i/")) {
    const id = combinedPath.split("/")[1];
    if (id) {
      return {
        pathname: "/party/[id]",
        params: { id, d: d || undefined },
      };
    }
  }

  if (combinedPath === "_share" || combinedPath === "__share" || combinedPath === "share") {
    if (inviteId) {
      return {
        pathname: "/party/[id]",
        params: { id: inviteId, d: d || undefined },
      };
    }

    return "/__share";
  }

  return null;
}
