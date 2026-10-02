import AsyncStorage from "@react-native-async-storage/async-storage";
import { createLocalRepository } from "./localRepository";

export const localRepository = createLocalRepository(AsyncStorage);
export const {
  getParties, getPartyById, saveParties, upsertParty,
  deletePartyById, getCurrentPartyId, setCurrentPartyId,
} = localRepository;
