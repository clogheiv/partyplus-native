import type { Party } from "./partyTypes";
import { classifyPartyError, PartyOperationError } from "./partyErrors";

export type DraftFields = {
  title: string; location: string; notes: string; date: string;
  items: string[]; pendingItem: string; manualItemPrefixLength: number;
};
export type PartyDraft = {
  id: string;
  key: string;
  fields: DraftFields;
  updatedAt: string;
  status: NonNullable<Party["cloudStatus"]>;
  operationId?: string;
  preparedParty?: Party;
  confirmedParty?: Party;
  baseParty?: Party;
  fingerprint?: string;
  error?: string;
};
export type CommitReceipt = { committed: true; operationId: string; party: Party };
export const emptyDraftFields = (): DraftFields => ({
  title: "", location: "", notes: "", date: "", items: [], pendingItem: "", manualItemPrefixLength: 0,
});

export function createDraft(key: string, id: string, fields = emptyDraftFields()): PartyDraft {
  return { key, id, fields, status: "local-only", updatedAt: new Date().toISOString() };
}

export function isPartyDraft(value: unknown, key: string): value is PartyDraft {
  const draft = value as PartyDraft;
  const fields = draft?.fields;
  return Boolean(draft && draft.key === key && typeof draft.id === "string" && draft.id &&
    ["local-only","pending","failed","committed","conflict"].includes(draft.status) && fields &&
    [fields.title, fields.date, fields.location, fields.notes, fields.pendingItem].every(field => typeof field === "string") &&
    Array.isArray(fields.items) && fields.items.every(item => typeof item === "string") &&
    Number.isInteger(fields.manualItemPrefixLength) && fields.manualItemPrefixLength >= 0 &&
    (!draft.operationId || (typeof draft.operationId === "string" && draft.preparedParty?.id === draft.id && typeof draft.fingerprint === "string")));
}

export function updateDraftFields(draft: PartyDraft, fields: DraftFields): PartyDraft {
  if (JSON.stringify(fields) === JSON.stringify(draft.fields)) return draft;
  if (draft.operationId && (draft.status === "pending" || draft.status === "failed")) {
    return { ...draft, fields, updatedAt: new Date().toISOString() };
  }
  return { ...draft, fields, status: "local-only", updatedAt: new Date().toISOString(), error: undefined,
    operationId: undefined, preparedParty: undefined, fingerprint: undefined };
}

export async function commitDraft(
  draft: PartyDraft,
  build: () => Party,
  allocateOperationId: () => string,
  persist: (draft: PartyDraft) => Promise<void>,
  commit: (party: Party, operationId: string) => Promise<CommitReceipt>,
): Promise<PartyDraft> {
  const fingerprint = JSON.stringify(draft.fields);
  const retry = draft.preparedParty && draft.operationId && draft.status !== "local-only";
  const party = retry ? draft.preparedParty! : build();
  if (party.id !== draft.id) throw new PartyOperationError("conflict", "Draft identity changed; nothing was sent.");
  const operationId = retry ? draft.operationId! : allocateOperationId();
  const pending: PartyDraft = { ...draft, fingerprint: retry ? draft.fingerprint : fingerprint, operationId, preparedParty: party, status: "pending", error: undefined };
  await persist(pending); // Sending is forbidden until the operation is durable.
  let receipt: CommitReceipt;
  try {
    receipt = await commit(party, operationId);
    if (receipt?.committed !== true || receipt.operationId !== operationId ||
      receipt.party?.id !== draft.id || !Number.isInteger(receipt.party.revision) || receipt.party.revision! < 1) {
      throw new PartyOperationError("server", "The server did not confirm this save. Retry uses the same party and operation.");
    }
  } catch (error) {
    const failure = classifyPartyError(error);
    const failed: PartyDraft = { ...pending, status: failure.kind === "conflict" ? "conflict" : "failed", error: failure.message };
    await persist(failed);
    return failed;
  }
  const confirmedParty = { ...receipt.party, cloudStatus: "committed" as const, cloudOperationId: operationId };
  const newerFields = retry && draft.fingerprint !== fingerprint;
  const committed: PartyDraft = { ...pending, preparedParty: confirmedParty, confirmedParty,
    status: newerFields ? "local-only" : "committed",
    operationId: newerFields ? undefined : operationId, fingerprint: newerFields ? undefined : fingerprint,
    error: newerFields ? "Previous save confirmed. Your newer draft is preserved; save again to send it." : undefined };
  // A local write failure after acknowledgement leaves the durable pending operation
  // intact. Its next retry asks for the exact same receipt; it cannot create another party.
  await persist(committed);
  return committed;
}
