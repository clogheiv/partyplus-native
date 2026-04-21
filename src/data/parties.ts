import type { Party, PartyItem, PartyRsvp } from "../lib/partyTypes";
import { getRemotePartyRsvps, replaceRemotePartyRsvps } from "./partyRsvps";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const PARTIES_TABLE = "parties";
const PARTY_ITEMS_TABLE = "party_items";
const PARTY_RSVPS_TABLE = "party_rsvps";
const PARTY_ITEM_COLUMNS = "id, party_id, name, qty, claimed_by, claimed_by_user_id, sort_order";

type PartyRow = {
  id: string;
  title?: string | null;
  date?: string | null;
  datetime?: string | null;
  location?: string | null;
  location_name?: string | null;
  notes?: string | null;
  theme?: string | null;
  host_id?: string | null;
  t?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PartyItemRow = {
  id: string;
  party_id: string;
  name: string;
  qty: string | null;
  claimed_by: string | null;
  claimed_by_user_id: string | null;
  sort_order: number | null;
};

type PartyInsertRow = {
  id: string;
  title: string;
  datetime: string | null;
  location_name: string | null;
  notes: string | null;
  host_id: string | null;
  created_at: string;
  updated_at: string;
};

type PartyUpdateRow = {
  title: string;
  datetime: string | null;
  location_name: string | null;
  notes: string | null;
  host_id: string | null;
  updated_at: string;
};
type PartyItemInsertRow = {
  id: string;
  party_id: string;
  name: string;
  qty: string | null;
  claimed_by: string | null;
  claimed_by_user_id: string | null;
  sort_order: number;
};

function nowISO() {
  return new Date().toISOString();
}

function toNullableText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toPartyInsertRow(party: Party): PartyInsertRow {
  const createdAt = party.createdAt ?? nowISO();
  const updatedAt = party.updatedAt ?? createdAt;

  return {
    id: party.id,
    title: party.title,
    datetime: toNullableText(party.date),
    location_name: toNullableText(party.location),
    notes: toNullableText(party.notes),
    host_id: toNullableText(party.hostId),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function toPartyUpdateRow(party: Party): PartyUpdateRow {
  return {
    title: party.title,
    datetime: toNullableText(party.date),
    location_name: toNullableText(party.location),
    notes: toNullableText(party.notes),
    host_id: toNullableText(party.hostId),
    updated_at: nowISO(),
  };
}

function toParty(party: PartyRow, items: PartyItem[], rsvps: PartyRsvp[]): Party {
  const createdAt = party.created_at ?? nowISO();
  const updatedAt = party.updated_at ?? createdAt;

  return {
    id: party.id,
    title: party.title ?? "Party",
    date: party.date ?? party.datetime ?? undefined,
    location: party.location ?? party.location_name ?? undefined,
    notes: party.notes ?? undefined,
    theme: party.theme ?? undefined,
    items,
    rsvps: rsvps.length ? rsvps : undefined,
    createdAt,
    updatedAt,
    hostId: party.host_id ?? undefined,
    t: party.t ?? undefined,
  };
}

function toPartyItem(item: PartyItemRow): PartyItem {
  return {
    id: item.id,
    name: item.name,
    qty: item.qty ?? undefined,
    claimedBy: item.claimed_by ?? undefined,
    claimedByUserId: item.claimed_by_user_id ?? undefined,
  };
}

function toPartyItemInsertRows(partyId: string, items: PartyItem[]): PartyItemInsertRow[] {
  return items.map((item, index) => ({
    id: item.id,
    party_id: partyId,
    name: item.name,
    qty: toNullableText(item.qty),
    claimed_by: toNullableText(item.claimedBy),
    claimed_by_user_id: toNullableText(item.claimedByUserId),
    sort_order: index,
  }));
}

export async function createRemoteParty(party: Party): Promise<Party | null> {
  if (!isSupabaseConfigured) return null;

  const { error } = await supabase
    .from(PARTIES_TABLE)
    .upsert(toPartyInsertRow(party), { onConflict: "id" });
  if (error) throw error;

  await replaceRemotePartyRsvps(party.id, party.rsvps ?? []);
  return party;
}

export async function getRemotePartyById(id: string): Promise<Party | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from(PARTIES_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [items, rsvps] = await Promise.all([
    getRemotePartyItems(id),
    getRemotePartyRsvps(id),
  ]);
  return toParty(data as PartyRow, items, rsvps);
}

export async function getRemoteParties(): Promise<Party[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from(PARTIES_TABLE)
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as PartyRow[];
  const parties = await Promise.all(
    rows.map(async (row) => {
      const [items, rsvps] = await Promise.all([
        getRemotePartyItems(row.id),
        getRemotePartyRsvps(row.id),
      ]);
      return toParty(row, items, rsvps);
    })
  );

  return parties;
}

export async function updateRemoteParty(party: Party): Promise<Party | null> {
  if (!isSupabaseConfigured) return null;

  const { error } = await supabase
    .from(PARTIES_TABLE)
    .update(toPartyUpdateRow(party))
    .eq("id", party.id);

  if (error) throw error;

  await Promise.all([
    replaceRemotePartyItems(party.id, party.items ?? []),
    replaceRemotePartyRsvps(party.id, party.rsvps ?? []),
  ]);
  return getRemotePartyById(party.id);
}

export async function deleteRemoteParty(partyId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error: rsvpDeleteError } = await supabase
    .from(PARTY_RSVPS_TABLE)
    .delete()
    .eq("party_id", partyId);
  if (rsvpDeleteError) throw rsvpDeleteError;

  const { error: itemDeleteError } = await supabase
    .from(PARTY_ITEMS_TABLE)
    .delete()
    .eq("party_id", partyId);
  if (itemDeleteError) throw itemDeleteError;

  const { error: partyDeleteError } = await supabase
    .from(PARTIES_TABLE)
    .delete()
    .eq("id", partyId);
  if (partyDeleteError) throw partyDeleteError;
}

export async function replaceRemotePartyItems(partyId: string, items: PartyItem[]): Promise<PartyItem[]> {
  if (!isSupabaseConfigured) return [];

  const { error: deleteError } = await supabase.from(PARTY_ITEMS_TABLE).delete().eq("party_id", partyId);
  if (deleteError) throw deleteError;

  const nextItems = items ?? [];
  if (!nextItems.length) return [];

  const { error: insertError } = await supabase
    .from(PARTY_ITEMS_TABLE)
    .insert(toPartyItemInsertRows(partyId, nextItems));

  if (insertError) throw insertError;

  return getRemotePartyItems(partyId);
}

export async function getRemotePartyItems(partyId: string): Promise<PartyItem[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from(PARTY_ITEMS_TABLE)
    .select(PARTY_ITEM_COLUMNS)
    .eq("party_id", partyId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((item) => toPartyItem(item as PartyItemRow));
}
