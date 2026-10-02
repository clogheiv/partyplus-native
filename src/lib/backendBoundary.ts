import { decode } from "base-64";

const PRODUCTION_HOST = "typbofemqhjoiwbkdvuc.supabase.co";

export function validateBackendBoundary(environment: string | undefined, url: string | null, key: string | null, development: boolean) {
  if (!url || !key) return { configured: false, reason: "Backend is not configured." };
  if (key.startsWith("sb_secret_")) return { configured: false, reason: "Clients require a public/publishable backend key." };
  if (key.startsWith("eyJ")) {
    try {
      const payload = key.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
      if (JSON.parse(decode(payload)).role !== "anon") return { configured: false, reason: "Clients cannot use a privileged backend key." };
    } catch { return { configured: false, reason: "Backend public key is invalid." }; }
  }
  let parsed: URL;
  try { parsed = new URL(url); } catch { return { configured: false, reason: "Backend URL is invalid." }; }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return { configured: false, reason: "Backend URL must not contain credentials, query parameters or fragments." };
  if (!["local", "staging", "production"].includes(environment ?? "")) {
    return { configured: false, reason: "Select an explicit backend environment." };
  }
  const isLocal = ["localhost", "127.0.0.1", "10.0.2.2", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(environment === "local" && isLocal && parsed.protocol === "http:")) {
    return { configured: false, reason: "Backend requires HTTPS or an explicit loopback local environment." };
  }
  if (environment === "local" && !isLocal) return { configured: false, reason: "Local clients require a loopback backend." };
  if (environment !== "production" && parsed.hostname === PRODUCTION_HOST) {
    return { configured: false, reason: "Nonproduction clients cannot use the production backend." };
  }
  if (development && environment === "production") return { configured: false, reason: "Development clients cannot use the production backend." };
  if (environment === "production" && parsed.hostname !== PRODUCTION_HOST) {
    return { configured: false, reason: "Production backend does not match the existing project." };
  }
  return { configured: true, reason: null };
}
