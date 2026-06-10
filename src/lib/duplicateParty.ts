import { createUuid } from "./ids";
import type { Party, PartyItem } from "./partyTypes";

function duplicatePartyItem(item: PartyItem): PartyItem {
  return {
    id: createUuid(),
    name: item.name,
    qty: item.qty,
    claimedBy: undefined,
    claimedByUserId: undefined,
    createdBy: undefined,
  };
}

export function buildDuplicateParty(source: Party, hostId: string): Party {
  const now = new Date().toISOString();

  return {
    id: createUuid(),
    title: source.title,
    date: source.date,
    location: source.location,
    notes: source.notes,
    theme: source.theme,
    items: (source.items ?? []).map(duplicatePartyItem),
    rsvps: [],
    createdAt: now,
    updatedAt: now,
    hostId,
  };
}
