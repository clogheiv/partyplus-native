import type { Party } from "../lib/partyTypes";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { callPartyContract, requireParty } from "./partyContract";
import { upsertParty } from "../lib/partyStore";
import { PartyOperationError } from "../lib/partyErrors";

export async function refreshHostParties() {
  if (!isSupabaseConfigured) return;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const user = data.session?.user;
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) return;
  const parties = await callPartyContract<Party[]>("partyplus_v2_list_host_parties", {});
  if (!Array.isArray(parties)) throw new PartyOperationError("server", "Host parties could not be loaded.");
  for (const party of parties) await upsertParty({ ...requireParty(party, party.id), cloudStatus: "committed" });
}
