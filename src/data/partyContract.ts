import type { Party, PartyRsvp } from "../lib/partyTypes";
import type { CommitReceipt } from "../lib/partyDraft";
import { backendBoundary, isSupabaseConfigured, supabase } from "../lib/supabase";
import { ensureSignedIdentity, ensureRecoverableHostIdentity } from "../lib/verifiedIdentity";
import { classifyPartyError, PartyOperationError } from "../lib/partyErrors";
import { requireCommitReceipt } from "../lib/partyValidation";
export { requireParty } from "../lib/partyValidation";

export async function callPartyContract<T>(name: string, parameters: Record<string, unknown>, mutation = false): Promise<T> {
  if (!isSupabaseConfigured) throw new PartyOperationError("configuration", backendBoundary.reason ?? "Backend is not configured.");
  if (mutation) await ensureSignedIdentity();
  const { data, error } = await supabase.rpc(name, parameters);
  if (error) throw classifyPartyError(error);
  return data as T;
}

export async function commitRemoteParty(party: Party, operationId: string): Promise<CommitReceipt> {
  await ensureRecoverableHostIdentity();
  const result = await callPartyContract<CommitReceipt>("partyplus_v2_commit_party", {
    p_operation_id: operationId, p_expected_revision: party.revision ?? 0,
    p_party: party,
  }, true);
  return requireCommitReceipt(result,party.id,operationId);
}

export async function saveRemoteRsvp(partyId: string, rsvp: Omit<PartyRsvp, "id">, operationId: string) {
  return requireCommitReceipt(await callPartyContract("partyplus_v2_rsvp", {
    p_party_id: partyId, p_operation_id: operationId, p_response: rsvp,
  }, true), partyId,operationId).party;
}

export async function setRemoteClaim(partyId: string, itemId: string, claim: boolean, operationId: string) {
  return requireCommitReceipt(await callPartyContract("partyplus_v2_claim_item", {
    p_party_id: partyId, p_item_id: itemId, p_claim: claim, p_operation_id: operationId,
  }, true), partyId,operationId).party;
}

export async function suggestRemoteItem(partyId: string, itemId: string, name: string, operationId: string) {
  return requireCommitReceipt(await callPartyContract("partyplus_v2_suggest_item", {
    p_party_id: partyId, p_item_id: itemId, p_name: name, p_operation_id: operationId,
  }, true), partyId,operationId).party;
}
