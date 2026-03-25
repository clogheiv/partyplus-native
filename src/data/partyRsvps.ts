import type { PartyRsvp } from "../lib/partyTypes";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const PARTY_RSVPS_TABLE = "party_rsvps";
const PARTY_RSVP_COLUMNS = "*";

type PartyRsvpRow = {
  id: string;
  party_id: string;
  name?: string | null;
  attendee_name?: string | null;
  guest_name?: string | null;
  status?: string | null;
  rsvp_status?: string | null;
  response?: string | null;
  attendee_count?: number | null;
  count?: number | null;
  party_size?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type PartyRsvpInsertRow = {
  id: string;
  party_id: string;
  name: string;
  status: PartyRsvp["status"];
  attendee_count: number;
  updated_at: string;
};

function nowISO() {
  return new Date().toISOString();
}

function toSafeAttendeeCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function toSafeStatus(value?: string | null): PartyRsvp["status"] {
  return value === 'yes' || value === 'no' || value === 'maybe' ? value : 'maybe';
}

function toRemotePartyRsvp(row: PartyRsvpRow): PartyRsvp {
  return {
    id: row.id,
    name: row.name ?? row.attendee_name ?? row.guest_name ?? "Guest",
    status: toSafeStatus(row.status ?? row.rsvp_status ?? row.response),
    attendeeCount: toSafeAttendeeCount(row.attendee_count ?? row.count ?? row.party_size),
    updatedAt: row.updated_at ?? row.created_at ?? nowISO(),
  };
}

function toPartyRsvpInsertRows(partyId: string, rsvps: PartyRsvp[]): PartyRsvpInsertRow[] {
  return (rsvps ?? []).map((rsvp) => ({
    id: rsvp.id,
    party_id: partyId,
    name: rsvp.name.trim(),
    status: rsvp.status,
    attendee_count: toSafeAttendeeCount(rsvp.attendeeCount),
    updated_at: rsvp.updatedAt ?? nowISO(),
  }));
}

export async function getRemotePartyRsvps(partyId: string): Promise<PartyRsvp[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from(PARTY_RSVPS_TABLE)
    .select(PARTY_RSVP_COLUMNS)
    .eq("party_id", partyId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => toRemotePartyRsvp(row as PartyRsvpRow));
}

export async function replaceRemotePartyRsvps(
  partyId: string,
  rsvps: PartyRsvp[]
): Promise<PartyRsvp[]> {
  if (!isSupabaseConfigured) return [];

  const { error: deleteError } = await supabase
    .from(PARTY_RSVPS_TABLE)
    .delete()
    .eq("party_id", partyId);
  if (deleteError) throw deleteError;

  const nextRsvps = toPartyRsvpInsertRows(partyId, rsvps ?? []);
  if (!nextRsvps.length) return [];

  const { error: insertError } = await supabase
    .from(PARTY_RSVPS_TABLE)
    .insert(nextRsvps);
  if (insertError) throw insertError;

  return getRemotePartyRsvps(partyId);
}
