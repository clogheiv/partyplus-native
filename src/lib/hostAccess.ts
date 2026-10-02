import type { Party } from "./partyTypes";
import { ensureUserId } from "./ids";
import { guestIdentityForView } from "./verifiedIdentity";

// Preserve local host tools during the bridge. This is a UI hint only, never
// evidence of server ownership; every mutation rechecks the signed account grant.
export async function offerHostTools(party: Party | null) {
  if (!party) return false;
  const [device, signed] = await Promise.all([ensureUserId(),guestIdentityForView()]);
  return Boolean(party.canEdit || (party.hostId && (party.hostId === device || party.hostId === signed)));
}
