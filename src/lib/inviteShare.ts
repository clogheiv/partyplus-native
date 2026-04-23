import { InteractionManager, Keyboard, Platform, Share } from "react-native";
import type { Party } from "./partyTypes";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForInteractions() {
  return new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
}

export function buildInviteLink(party: Party) {
  return `https://partyplus-invite.netlify.app/i/${party.id}`;
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
  const inviteLink = buildInviteLink(party);

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
        "Bring list:",
        ...shown.map((name) => {
          const key = name.toLowerCase();
          const count = counts.get(key) ?? 1;
          return `- ${name}${count > 1 ? ` (x${count})` : ""}`;
        }),
        ...(remaining > 0 ? [`- and ${remaining} more`] : []),
      ].join("\n")
    : "";

  const intro = `You're invited to ${title}!`;
  const closing = items.length
    ? "Open the invite below to RSVP and claim something to bring:"
    : "Open the invite below to RSVP:";

  return [
    intro,
    when,
    where,
    notes,
    itemsPreview,
    "",
    closing,
    inviteLink,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSharePayload(party: Party) {
  const message = buildShareMessage(party).trim();
  const url = buildInviteLink(party).trim();

  if (!message) {
    throw new Error("Invite share message is empty.");
  }

  if (!url) {
    throw new Error("Invite share link is empty.");
  }

  return { message, url };
}

export async function sharePartyInvite(party: Party) {
  const { message, url } = buildSharePayload(party);
  console.log("[invite] sharePayload", {
    partyId: party.id,
    url,
    messageLength: message.length,
    itemCount: party.items?.length ?? 0,
  });

  Keyboard.dismiss();

  if (Platform.OS === "ios") {
    await waitForInteractions();
    await wait(75);

    return Share.share(
      {
        message,
      },
      {
        subject: party.title?.trim() || "Party Invite",
      }
    );
  }

  return Share.share({ message });
}
