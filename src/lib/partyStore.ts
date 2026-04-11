import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Party } from "./partyTypes";

const KEY = "partyplus.parties.v1";
const CURRENT_KEY = "partyplus.currentPartyId.v1";

function nowISO() {
  return new Date().toISOString();
}

function normalizePartyId(id: unknown): string {
  return String(id ?? "").trim();
}

function updatedAtValue(party: Party): number {
  const timestamp = Date.parse(party.updatedAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function dedupeParties(parties: Party[]): { parties: Party[]; changed: boolean } {
  const next: Party[] = [];
  let changed = false;

  for (const party of parties) {
    const normalizedId = normalizePartyId(party?.id);
    if (!normalizedId) {
      changed = true;
      continue;
    }

    const normalizedParty: Party = normalizedId === party.id ? party : { ...party, id: normalizedId };
    if (normalizedParty !== party) {
      changed = true;
    }

    const existingIndex = next.findIndex((entry) => entry.id === normalizedId);
    if (existingIndex === -1) {
      next.push(normalizedParty);
      continue;
    }

    changed = true;
    if (updatedAtValue(normalizedParty) >= updatedAtValue(next[existingIndex])) {
      next[existingIndex] = normalizedParty;
    }
  }

  if (!changed && next.length !== parties.length) {
    changed = true;
  }

  return { parties: next, changed };
}

export async function getParties(): Promise<Party[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Party[];
    if (!Array.isArray(parsed)) return [];

    const { parties, changed } = dedupeParties(parsed);
    if (changed) {
      await saveParties(parties);
    }

    return parties;
  } catch {
    return [];
  }
}

export async function saveParties(parties: Party[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(parties));
}

export async function upsertParty(party: Party): Promise<void> {
  const parties = await getParties();
  const normalizedId = normalizePartyId(party.id);
  const idx = parties.findIndex((p) => p.id === normalizedId);

  const updated: Party = {
    ...party,
    id: normalizedId,
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

export async function deletePartyById(id: string): Promise<void> {
  const normalizedId = normalizePartyId(id);
  if (!normalizedId) return;

  const parties = await getParties();
  const next = parties.filter((party) => party.id !== normalizedId);

  if (next.length !== parties.length) {
    await saveParties(next);
  }

  const currentId = await getCurrentPartyId();
  if (normalizePartyId(currentId) === normalizedId) {
    await AsyncStorage.removeItem(CURRENT_KEY);
  }
}

export async function getPartyById(id: string): Promise<Party | null> {
  const parties = await getParties();
  const normalizedId = normalizePartyId(id);
  return parties.find((p) => p.id === normalizedId) ?? null;
}
