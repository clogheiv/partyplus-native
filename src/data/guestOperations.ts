import { createPartyOutbox } from "../lib/partyOutbox";
import { localRepository, upsertParty, deletePartyById } from "../lib/partyStore";
import { PartyOperationError } from "../lib/partyErrors";
import { createUuid } from "../lib/ids";
import { ensureSignedIdentity } from "../lib/verifiedIdentity";
import { deleteRemoteParty } from "./parties";
import { saveRemoteRsvp, setRemoteClaim, suggestRemoteItem } from "./partyContract";

export const guestOperations = createPartyOutbox(localRepository, createUuid, ensureSignedIdentity, async operation => {
  const { intent, partyId, operationId } = operation;
  if (intent.kind === "delete") {
    await deleteRemoteParty(partyId, operationId);
    try {
      await deletePartyById(partyId);
      await localRepository.removeDraft("edit:" + partyId);
    } catch { throw new PartyOperationError("local_corrupt", "Deletion confirmed online, but local cleanup needs recovery. The same operation is preserved for retry."); }
    return null;
  }
  const party = intent.kind === "rsvp"
    ? await saveRemoteRsvp(partyId, { ...intent.response, updatedAt: "" }, operationId)
    : intent.kind === "claim" ? await setRemoteClaim(partyId, intent.itemId, intent.claim, operationId)
      : await suggestRemoteItem(partyId, intent.itemId!, intent.name, operationId);
  try { await upsertParty({ ...party, cloudStatus: "committed" }); }
  catch { throw new PartyOperationError("local_corrupt", "Saved online, but this device could not update its cache. The pending operation is preserved for retry."); }
  return party;
});
