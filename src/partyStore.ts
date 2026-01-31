// TEMP

import AsyncStorage from "@react-native-async-storage/async-storage";
type PartyItem = {
  id: string;
  name: string;
  claimedBy?: string | null;
};

type Party = {
  id: string;
  title: string;
  location?: string | null;
  notes?: string | null;
  date?: string | null;
  items: PartyItem[];
  createdAt?: string;
  updatedAt?: string;
};


const KEY = "partyplus.parties.v1";
const CURRENT_KEY = "partyplus.currentPartyId.v1";

function nowISO() {
  return new Date().toISOString();
}

export async function getParties(): Promise<Party[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Party[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveParties(parties: Party[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(parties));
}

export async function upsertParty(party: Party): Promise<void> {
  const parties = await getParties();
  const idx = parties.findIndex(p => p.id === party.id);

  const updated: Party = {
    ...party,
    createdAt: party.createdAt ?? nowISO(),
    updatedAt: nowISO(),
  };

  if (idx === -1) parties.unshift(updated);
  else parties[idx] = updated;

  await saveParties(parties);
}

export async function setCurrentPartyId(id: string): Promise<void> {
  await AsyncStorage.setItem(CURRENT_KEY, id);
}

export async function getCurrentPartyId(): Promise<string | null> {
  return AsyncStorage.getItem(CURRENT_KEY);
}

export async function getPartyById(id: string) {
  const targetId = String(id);

  // IMPORTANT: load the persisted parties first
  const parties = await getParties();

return parties.find((p: any) => String(p.id) === targetId) ?? null;  
}

