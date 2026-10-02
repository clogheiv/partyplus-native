import type { Href } from "expo-router";

export function routeFromUrl(input: string): Href | null {
  try {
    const normalized = input.startsWith("intent://")
      ? input.replace(/^intent:\/\//,"partyplusnative://").replace(/#Intent;.*$/,"") : input;
    const url = new URL(normalized);
    const scheme = url.protocol.replace(":","");
    const native = ["partyplusnative","partyplusnative-dev","partyplusnative-preview"].includes(scheme);
    const expo = ["exp","exps"].includes(scheme);
    if (!native && !expo && !["http","https"].includes(scheme)) return null;
    if (!native && !expo) {
      const configured = process.env.EXPO_PUBLIC_INVITE_BASE_URL;
      const allowed = ["partyplus-invite.netlify.app","localhost","127.0.0.1", ...(configured ? [new URL(configured).hostname] : [])];
      if (!allowed.includes(url.hostname)) return null;
    }
    const path = native ? url.hostname + url.pathname : expo ? url.pathname.replace(/^\/--\//,"/") : url.pathname;
    const segments = path.split("/").filter(Boolean);
    const d = url.searchParams.get("d") ?? url.searchParams.get("data") ?? url.searchParams.get("payload") ?? undefined;
    const id = ["party","i"].includes(segments[0]) ? decodeURIComponent(segments[1] ?? "")
      : ["share","_share","__share"].includes(segments[0]) ? url.searchParams.get("id") ?? "" : "";
    if (id && id.length <= 200 && !/[\/\\\u0000-\u001f]/.test(id)) return { pathname:"/party/[id]", params:{id,d:d || undefined} };
    if (!id && ["share","_share","__share"].includes(segments[0])) return "/__share";
    return null;
  } catch { return null; }
}
