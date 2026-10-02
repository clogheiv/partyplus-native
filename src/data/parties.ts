import type { Party, PartyItem } from "../lib/partyTypes";
import { getRemotePartyRsvps } from "./partyRsvps";
import { backendBoundary, isSupabaseConfigured, supabase } from "../lib/supabase";
import { classifyPartyError, PartyOperationError } from "../lib/partyErrors";
import { callPartyContract, commitRemoteParty, requireParty } from "./partyContract";

export async function getRemotePartyById(id: string): Promise<Party | null> {
  if (!isSupabaseConfigured) throw new PartyOperationError("configuration", backendBoundary.reason ?? "Backend is not configured.");
  try {
    const party = await callPartyContract<Party | null>("partyplus_v2_read_party", { p_party_id: id });
    return party ? { ...requireParty(party, id), cloudStatus: "committed" } : null;
  } catch (error) {
    // Retain legacy read compatibility only. Never fall back to legacy writes.
    if (classifyPartyError(error).kind !== "upgrade-required") throw error;
  }
  const { data, error } = await supabase.from("parties").select("*").eq("id", id).maybeSingle();
  if (error) throw classifyPartyError(error);
  if (!data) return null;
  const [items, rsvps] = await Promise.all([getRemotePartyItems(id), getRemotePartyRsvps(id)]);
  return {
    id: data.id, title: data.title ?? "Party", date: data.date ?? data.datetime ?? undefined,
    location: data.location ?? data.location_name ?? undefined, notes: data.notes ?? undefined,
    theme: data.theme ?? undefined, hostId: data.host_id ?? undefined, t: data.t ?? undefined,
    createdAt: data.created_at ?? "", updatedAt: data.updated_at ?? "", items, rsvps,
  };
}

export async function getRemotePartyItems(partyId: string): Promise<PartyItem[]> {
  if (!isSupabaseConfigured) throw new PartyOperationError("configuration", "Backend is not configured.");
  // select(*) preserves older schemas without broad error-string-based write fallback.
  const { data, error } = await supabase.from("party_items").select("*").eq("party_id", partyId).order("sort_order", { ascending: true });
  if (error) throw classifyPartyError(error);
  return (data ?? []).map((item) => ({
    id: item.id, name: item.name, qty: item.qty ?? undefined,
    claimedBy: item.claimed_by ?? undefined, claimedByUserId: item.claimed_by_user_id ?? undefined,
    createdBy: item.created_by ?? undefined,
  }));
}

export async function createRemoteParty(party: Party, operationId: string): Promise<Party> {
  const receipt = await commitRemoteParty(party, operationId);
  return { ...receipt.party, cloudStatus: "committed", cloudOperationId: receipt.operationId };
}
export const updateRemoteParty = createRemoteParty;

export async function deleteRemoteParty(partyId: string, operationId: string): Promise<void> {
  const result = await callPartyContract<{ deleted: boolean; operationId: string }>("partyplus_v2_delete_party", {
    p_party_id: partyId, p_operation_id: operationId,
  }, true);
  if (result?.deleted !== true || result.operationId !== operationId) {
    throw new PartyOperationError("server", "The server did not confirm deletion. Retry the same operation.");
  }
}
