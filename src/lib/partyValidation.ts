import type { Party } from "./partyTypes";
import { PartyOperationError } from "./partyErrors";
import type { CommitReceipt } from "./partyDraft";

export function requireCommitReceipt(value: unknown, partyId: string, operationId: string): CommitReceipt {
  const receipt = value as CommitReceipt;
  if (receipt?.committed !== true || receipt.operationId !== operationId) {
    throw new PartyOperationError("server", "The server did not acknowledge this operation. Retry uses the same pending change.");
  }
  return { ...receipt, party: requireParty(receipt.party,partyId) };
}

export function requireParty(value: unknown, id: string): Party {
  const party = value as Party;
  if (!party || party.id !== id || typeof party.title !== "string" || !Array.isArray(party.items) ||
    !Number.isInteger(party.revision) || party.revision! < 1 ||
    !party.items.every(item => item && typeof item.id === "string" && typeof item.name === "string") ||
    !Array.isArray(party.rsvps) || !party.rsvps.every(rsvp => rsvp && typeof rsvp.id === "string" && typeof rsvp.name === "string" &&
      ["yes","maybe","no"].includes(rsvp.status) && Number.isInteger(rsvp.attendeeCount) && rsvp.attendeeCount >= 1)) {
    throw new PartyOperationError("server", "The server returned incomplete party information.");
  }
  return party;
}

export function newerParty(current: Party | null, next: Party | null) {
  if (current && next && current.id === next.id && current.revision !== undefined &&
    (next.revision === undefined || current.revision > next.revision)) return current;
  return next;
}
