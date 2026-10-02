import type { PartyRsvp } from "../lib/partyTypes";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { classifyPartyError, PartyOperationError } from "../lib/partyErrors";

export async function getRemotePartyRsvps(partyId: string): Promise<PartyRsvp[]> {
  if (!isSupabaseConfigured) throw new PartyOperationError("configuration", "Backend is not configured.");
  const { data, error } = await supabase.from("party_rsvps").select("*").eq("party_id", partyId).order("updated_at", { ascending: false });
  if (error) throw classifyPartyError(error);
  return (data ?? []).map((row) => ({
    id: row.id, name: row.name ?? row.attendee_name ?? row.guest_name ?? "Guest",
    status: ["yes", "no", "maybe"].includes(row.status ?? row.rsvp_status ?? row.response) ? row.status ?? row.rsvp_status ?? row.response : "maybe",
    attendeeCount: Number.isFinite(Number(row.attendee_count ?? row.count ?? row.party_size ?? 1))
      ? Math.max(1, Math.floor(Number(row.attendee_count ?? row.count ?? row.party_size ?? 1))) : 1,
    updatedAt: row.updated_at ?? row.created_at ?? "",
  }));
}
