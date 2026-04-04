import { encode as b64encode } from "base-64";
import type { Party } from "./partyTypes";

function toBase64Url(input: string) {
  return b64encode(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function buildInviteData(party: Party) {
  const payload = {
    t: party.title ?? "",
    dt: party.date ?? "",
    l: party.location ?? "",
    a: "",
    la: null,
    ln: null,
    items: Array.isArray(party.items)
      ? party.items.map((it) => ({
          name: it.name ?? "",
          qty: it.qty ?? undefined,
          claimedBy: it.claimedBy ?? undefined,
        }))
      : [],
  };

  return toBase64Url(JSON.stringify(payload));
}

export function buildInviteLink(party: Party) {
  return `https://partyplus-invite.netlify.app/i/${party.id}?d=${encodeURIComponent(
    buildInviteData(party)
  )}`;
}

export function buildShareMessage(party: Party) {
  const title = party.title?.trim() || "Party";

  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const when = party.date ? `When: ${formatWhen(party.date)}` : "";
  const where = party.location?.trim() ? `Where: ${party.location.trim()}` : "";
  const notes = party.notes?.trim() ? `Notes: ${party.notes.trim()}` : "";
  const items = party.items ?? [];

  const counts = new Map<string, number>();
  for (const it of items) {
    const name = (it?.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const displayNames: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const name = (it?.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    displayNames.push(name);
  }

  const shown = displayNames.slice(0, 5);
  const remaining = displayNames.length - shown.length;
  const itemsPreview = items.length
    ? [
        "",
        "What to bring",
        ...shown.map((name) => {
          const key = name.toLowerCase();
          const count = counts.get(key) ?? 1;
          return `- ${name}${count > 1 ? ` (x${count})` : ""}`;
        }),
        ...(remaining > 0 ? [`...and ${remaining} more`] : []),
      ].join("\n")
    : "";

  return [
    title,
    when,
    where,
    notes,
    itemsPreview,
    "",
    "Open in PartyPlus to RSVP and claim an item:",
    buildInviteLink(party),
  ]
    .filter(Boolean)
    .join("\n");
}
