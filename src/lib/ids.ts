import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_ID_KEY = "userId";

export function isUuid(value?: string | null): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function createUuid() {
  const nativeUuid = globalThis.crypto?.randomUUID?.();
  if (nativeUuid) return nativeUuid;

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function ensureUuid(value?: string | null) {
  return isUuid(value) ? value : createUuid();
}

export async function ensureUserId() {
  const storedUserId = await AsyncStorage.getItem(USER_ID_KEY);
  if (isUuid(storedUserId)) return storedUserId;

  const nextUserId = createUuid();
  await AsyncStorage.setItem(USER_ID_KEY, nextUserId);
  return nextUserId;
}
