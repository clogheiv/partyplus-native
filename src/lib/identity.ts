import type { StorageAdapter } from "./localRepository";

export function createDeviceIdentity(storage: StorageAdapter, allocate: () => string) {
  let initializing: Promise<string> | undefined;
  return function ensureDeviceIdentity(): Promise<string> {
    if (!initializing) {
      initializing = (async () => {
        const current = await storage.getItem("userId");
        if (current?.trim()) return current;
        const id = allocate();
        await storage.setItem("userId", id);
        return id;
      })();
      initializing.catch(() => { initializing = undefined; });
    }
    return initializing;
  };
}
