import type { Party } from "./partyTypes";

export type StorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  runExclusive?<T>(operation: () => Promise<T>): Promise<T>;
};

export class LocalDataError extends Error {
  readonly code = "local_corrupt";
  constructor(readonly key: string) {
    super("Saved data needs recovery. The original data has been preserved.");
  }
}

export class LocalStorageError extends Error {
  readonly code = "local_unavailable";
  constructor() { super("This device could not access saved data. Keep this screen open and retry before closing it."); }
}

export const PARTY_CACHE_KEY = "partyplus.parties.v1";
export const CURRENT_PARTY_KEY = "partyplus.currentPartyId.v1";
export const DRAFTS_KEY = "partyplus.drafts.v2";

export function createLocalRepository(storage: StorageAdapter) {
  const backing = storage;
  storage = {
    ...backing,
    async getItem(key) { try { return await backing.getItem(key); } catch { throw new LocalStorageError(); } },
    async setItem(key,value) { try { await backing.setItem(key,value); } catch { throw new LocalStorageError(); } },
    async removeItem(key) { try { await backing.removeItem(key); } catch { throw new LocalStorageError(); } },
  };
  let queue: Promise<unknown> = Promise.resolve();
  let backupSequence = 0;
  const backedUp = new Map<string, string>();

  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(() => storage.runExclusive ? storage.runExclusive(operation) : operation());
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  async function read<T>(key: string, empty: T, valid: (value: unknown) => value is T): Promise<T> {
    const raw = await storage.getItem(key);
    if (raw === null) return empty;
    try {
      const value: unknown = JSON.parse(raw);
      if (!valid(value)) throw new Error("Invalid stored shape");
      return value;
    } catch {
      if (backedUp.get(key) !== raw) {
        const backupKey = `${key}.recovery.${Date.now()}.${++backupSequence}`;
        if (await storage.getItem(backupKey) !== null) throw new LocalDataError(key);
        await storage.setItem(backupKey, JSON.stringify({ source: key, raw, capturedAt: new Date().toISOString() }));
        backedUp.set(key, raw);
      }
      throw new LocalDataError(key);
    }
  }

  function isPartyList(value: unknown): value is Party[] {
    return Array.isArray(value) && value.every((entry) =>
      entry && typeof entry === "object" && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.title === "string" && Array.isArray(entry.items) &&
      entry.items.every((item: unknown) => item && typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string" && typeof (item as { name?: unknown }).name === "string")
    );
  }

  const readParties = () => read(PARTY_CACHE_KEY, [], isPartyList);
  const readDrafts = () => read<Record<string, unknown>>(DRAFTS_KEY, {}, (value): value is Record<string, unknown> =>
    Boolean(value && typeof value === "object" && !Array.isArray(value)));

  return {
    getParties: () => serialized(readParties),
    getPartyById: (id: string) => serialized(async () => (await readParties()).find((party) => party.id === id) ?? null),
    upsertParty: (party: Party) => serialized(async () => {
      if (!isPartyList([party])) throw new Error("Invalid party");
      const parties = await readParties();
      const index = parties.findIndex((entry) => entry.id === party.id);
      if (index >= 0 && parties[index].revision !== undefined &&
        (party.revision === undefined || parties[index].revision! > party.revision)) return;
      const next = { ...party, createdAt: party.createdAt ?? new Date().toISOString() };
      if (index < 0) parties.unshift(next);
      else parties[index] = next;
      await storage.setItem(PARTY_CACHE_KEY, JSON.stringify(parties));
    }),
    saveParties: (parties: Party[]) => serialized(async () => {
      await readParties();
      if (!isPartyList(parties)) throw new Error("Invalid party list");
      await storage.setItem(PARTY_CACHE_KEY, JSON.stringify(parties));
    }),
    deletePartyById: (id: string) => serialized(async () => {
      const parties = await readParties();
      await storage.setItem(PARTY_CACHE_KEY, JSON.stringify(parties.filter((party) => party.id !== id)));
      if (await storage.getItem(CURRENT_PARTY_KEY) === id) await storage.removeItem(CURRENT_PARTY_KEY);
    }),
    setCurrentPartyId: (id: string) => serialized(() => storage.setItem(CURRENT_PARTY_KEY, id)),
    getCurrentPartyId: () => serialized(() => storage.getItem(CURRENT_PARTY_KEY)),
    getDraft: <T>(key: string) => serialized(async () => (await readDrafts())[key] as T | undefined),
    setDraft: <T>(key: string, draft: T) => serialized(async () => {
      const drafts = await readDrafts();
      drafts[key] = draft;
      await storage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    }),
    removeDraft: (key: string) => serialized(async () => {
      const drafts = await readDrafts();
      delete drafts[key];
      await storage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    }),
    archiveDraft: (key: string, recoveryKey: string) => serialized(async () => {
      const drafts = await readDrafts();
      if (!(key in drafts)) return;
      if (key === recoveryKey || recoveryKey in drafts) throw new Error("Recovery draft already exists");
      drafts[recoveryKey] = drafts[key];
      delete drafts[key];
      await storage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    }),
  };
}
